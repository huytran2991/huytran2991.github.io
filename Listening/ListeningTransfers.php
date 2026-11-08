<?php
// Standalone import of server-selected Listening text into one fixed Speaking lesson.
function listeningTransferSource(string $directory, array $request): string
{
    $file = $request['lesson'] ?? null;
    $revision = $request['revision'] ?? null;
    $index = $request['index'] ?? null;
    if (!is_string($file) || strlen($file) > 1024 || !preg_match('/\.txt\z/i', $file)
        || !is_string($revision) || !preg_match('/\A[a-f0-9]{64}\z/', $revision)
        || !is_int($index) || $index < 0 || !is_dir($directory) || is_link($directory)) {
        throw new InvalidArgumentException('Choose a current lesson and sentence.');
    }
    $path = $directory;
    foreach (explode('/', $file) as $part) {
        if ($part === '' || $part === '.' || $part === '..' || preg_match('/[\x00-\x1f\x7f\\\\]/', $part)) {
            throw new InvalidArgumentException('Invalid lesson path.');
        }
        $path .= '/' . $part;
        if (is_link($path)) {
            throw new InvalidArgumentException('Symbolic links are not supported.');
        }
    }
    if (!is_file($path)) {
        throw new UnexpectedValueException('The source lesson is missing. Reload Listening.');
    }
    $handle = fopen($path, 'rb');
    if ($handle === false) {
        throw new RuntimeException('Unable to read the source lesson.');
    }
    try {
        if (!flock($handle, LOCK_SH)) {
            throw new RuntimeException('Unable to lock the source lesson.');
        }
        $stat = fstat($handle);
        if (!$stat || $stat['size'] > 2 * 1024 * 1024) {
            throw new InvalidArgumentException('The source lesson is too large.');
        }
        $content = stream_get_contents($handle);
        if ($content === false || preg_match('//u', $content) !== 1 || strpos($content, "\0") !== false) {
            throw new RuntimeException('Unable to read the UTF-8 source lesson.');
        }
        if (!hash_equals(hash('sha256', $content), $revision)) {
            throw new UnexpectedValueException('The source lesson changed. Reload Listening before adding this sentence.');
        }
        $content = preg_replace('/\A\xEF\xBB\xBF/', '', $content);
        $lines = array_values(array_filter(array_map('trim', preg_split('/\r\n|\r|\n/', $content)), static fn(string $line): bool => $line !== ''));
        if (!isset($lines[$index])) {
            throw new InvalidArgumentException('Choose an available sentence.');
        }
        return $lines[$index];
    } finally {
        flock($handle, LOCK_UN);
        fclose($handle);
    }
}

function listeningAppendSpeaking(string $directory, string $answer): bool
{
    if (trim($answer) === '' || strlen($answer) > 100000 || strpos($answer, "\0") !== false || preg_match('//u', $answer) !== 1) {
        throw new InvalidArgumentException('Invalid lesson sentence.');
    }
    // Keep each imported source sentence on one line.
    $answer = trim(preg_replace('/\s+/u', ' ', $answer));
    if ($answer === '' || preg_match('/[\x00-\x1f\x7f]/', $answer)) {
        throw new InvalidArgumentException('Invalid lesson sentence.');
    }
    if (!is_dir($directory) || is_link($directory) || is_link(dirname($directory))) {
        throw new RuntimeException('The practice lesson folder is unavailable.');
    }
    $path = $directory . '/From Listening.txt';
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
            throw new RuntimeException('Unable to save the complete sentence. Try again.');
        }
        return true;
    } finally {
        flock($handle, LOCK_UN);
        fclose($handle);
    }
}
