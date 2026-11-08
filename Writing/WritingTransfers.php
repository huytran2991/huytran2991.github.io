<?php
// Only accepted Writing answers may be appended to daily files in the two fixed destinations.
require_once __DIR__ . '/WritingSupport.php';

function writingRememberAccepted(array $review, array $request): ?string
{
    if (($review['verdict'] ?? null) !== 'accepted') {
        return null;
    }
    if (!writingText($request['answer'] ?? null, 2000)) {
        throw new InvalidArgumentException('Invalid accepted translation.');
    }
    $records = array_filter($_SESSION['writing_transfers'] ?? [], static fn(array $record): bool => $record['expires'] > time());
    $records = array_slice($records, -99, null, true);
    $token = bin2hex(random_bytes(32));
    $records[$token] = [
        'lesson' => $request['lesson'], 'revision' => $request['revision'], 'sentence' => $request['sentence'],
        'answer' => trim($request['answer']), 'expires' => time() + 7200,
    ];
    $_SESSION['writing_transfers'] = $records;
    return $token;
}

function writingAcceptedTransfer(array $request, array $lessons): string
{
    $token = $request['transferToken'] ?? null;
    if (!is_string($token) || !preg_match('/\A[a-f0-9]{64}\z/', $token)) {
        throw new InvalidArgumentException('Review this translation successfully before adding it to practice.');
    }
    $record = $_SESSION['writing_transfers'][$token] ?? null;
    if (!$record || $record['expires'] <= time()) {
        throw new UnexpectedValueException('This acceptance has expired. Review your translation again.');
    }
    writingReviewTarget($lessons, $record); // Reject a deleted sentence or a changed source lesson.
    return $record['answer'];
}

function writingTransferDirectory($target): string
{
    if (!in_array($target, ['Speaking', 'Listening'], true)) {
        throw new InvalidArgumentException('Choose Speaking or Listening.');
    }
    return englishDataPath($target . '/lessons');
}

function writingTransferFilename(?DateTimeImmutable $now = null): string
{
    $timezone = new DateTimeZone('Asia/Ho_Chi_Minh');
    $now = ($now ?? new DateTimeImmutable('now', $timezone))->setTimezone($timezone);
    return 'From Writing_' . $now->format('Y_m_d') . '.txt';
}

function writingAppendTransfer(string $directory, string $answer, ?DateTimeImmutable $now = null): bool
{
    if (!writingText($answer, 2000)) {
        throw new InvalidArgumentException('Invalid accepted translation.');
    }
    // One accepted translation occupies one lesson line, including multiline drafts.
    $answer = trim(preg_replace('/\s+/u', ' ', $answer));
    if ($answer === '' || preg_match('/[\x00-\x1f\x7f]/', $answer)) {
        throw new InvalidArgumentException('Invalid translation text.');
    }
    if (!is_dir($directory) || is_link($directory) || is_link(dirname($directory))) {
        throw new RuntimeException('The practice lesson folder is unavailable.');
    }
    $path = $directory . '/' . writingTransferFilename($now);
    if (is_link($path) || (file_exists($path) && !is_file($path))) {
        throw new RuntimeException('The practice lesson file is unavailable.');
    }
    $handle = fopen($path, 'c+b');
    if ($handle === false) {
        throw new RuntimeException('Unable to open the practice lesson. Check file permissions.');
    }
    try {
        if (!flock($handle, LOCK_EX)) {
            throw new RuntimeException('Unable to lock the practice lesson.');
        }
        clearstatcache(true, $path);
        $opened = fstat($handle);
        $current = lstat($path);
        if (is_link($path) || !$opened || !$current || $opened['ino'] !== $current['ino'] || $opened['dev'] !== $current['dev']) {
            throw new RuntimeException('The practice lesson changed. Try again.');
        }
        if ($opened['size'] > 2 * 1024 * 1024) {
            throw new RuntimeException('The practice lesson is full. Use its editor to remove older sentences.');
        }
        $original = stream_get_contents($handle);
        if ($original === false || preg_match('//u', $original) !== 1 || strpos($original, "\0") !== false) {
            throw new RuntimeException('Unable to read the UTF-8 practice lesson.');
        }
        $key = static fn(string $line): string => mb_strtolower(trim(preg_replace('/\s+/u', ' ', $line)), 'UTF-8');
        $text = preg_replace('/\A\xEF\xBB\xBF/', '', $original);
        foreach (preg_split('/\r\n|\r|\n/', $text) as $line) {
            if ($key($line) === $key($answer)) {
                return false;
            }
        }
        $addition = ($original !== '' && !preg_match('/[\r\n]\z/', $original) ? "\n" : '') . $answer . "\n";
        if (strlen($original) + strlen($addition) > 2 * 1024 * 1024) {
            throw new RuntimeException('The practice lesson is full. Use its editor to remove older sentences.');
        }
        if (fseek($handle, 0, SEEK_END) !== 0 || fwrite($handle, $addition) !== strlen($addition) || !fflush($handle)) {
            ftruncate($handle, strlen($original));
            fflush($handle);
            throw new RuntimeException('Unable to save the complete translation. Try again.');
        }
        return true;
    } finally {
        flock($handle, LOCK_UN);
        fclose($handle);
    }
}
