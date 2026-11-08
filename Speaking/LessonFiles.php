<?php

/** Plain-text lesson files only; practice results never belong in these files. */
final class LessonFiles
{
    private string $directory;

    public function __construct(string $directory)
    {
        $resolved = realpath($directory);
        if ($resolved === false || !is_dir($resolved)) {
            throw new RuntimeException('Lesson folder not found.');
        }
        $this->directory = $resolved;
    }

    private function path(string $file): string
    {
        if (strlen($file) > 180 || !preg_match('/\A[\p{L}\p{N}][\p{L}\p{N} _().-]*\.txt\z/u', $file)) {
            throw new InvalidArgumentException('Invalid filename. Only .txt files in the lessons folder are allowed.');
        }
        $path = $this->directory . DIRECTORY_SEPARATOR . $file;
        if (is_link($path)) {
            throw new InvalidArgumentException('Symbolic links are not supported.');
        }
        return $path;
    }

    public function all(): array
    {
        $lessons = [];
        $files = glob($this->directory . '/*.txt') ?: [];
        natcasesort($files);
        foreach ($files as $path) {
            if (is_link($path) || !is_file($path)) {
                continue;
            }
            $lesson = $this->get(basename($path));
            if ($lesson !== null) {
                $lessons[] = $lesson;
            }
        }
        return $lessons;
    }

    public function get(string $file): ?array
    {
        $path = $this->path($file);
        if (!is_file($path)) {
            return null;
        }
        $handle = fopen($path, 'rb');
        if ($handle === false) {
            throw new RuntimeException('Unable to read the lesson file.');
        }
        try {
            if (!flock($handle, LOCK_SH)) {
                throw new RuntimeException('Unable to lock the lesson file.');
            }
            $content = stream_get_contents($handle);
            if ($content === false) {
                throw new RuntimeException('Unable to read the lesson content.');
            }
            $lines = self::lines($content);
            return [
                'id' => $file,
                'name' => substr($file, 0, -4),
                'lines' => $lines,
                'revision' => hash('sha256', $content),
                'duplicates' => self::duplicates($lines),
            ];
        } finally {
            flock($handle, LOCK_UN);
            fclose($handle);
        }
    }

    private static function lines(string $text): array
    {
        $text = preg_replace('/\A\xEF\xBB\xBF/', '', $text);
        return array_values(array_filter(array_map('trim', preg_split('/\r\n|\n|\r/', $text)), static fn($line) => $line !== ''));
    }

    private static function sentenceKey(string $text): string
    {
        return mb_strtolower(preg_replace('/\s+/u', ' ', trim($text)), 'UTF-8');
    }

    private static function duplicates(array $lines): array
    {
        $groups = [];
        foreach ($lines as $index => $line) {
            $key = self::sentenceKey($line);
            if (!isset($groups[$key])) {
                $groups[$key] = ['text' => $line, 'positions' => []];
            }
            $groups[$key]['positions'][] = $index + 1;
        }
        return array_values(array_filter($groups, static fn($group) => count($group['positions']) > 1));
    }

    private static function assertUniqueAdditions(array $existing, array $additions): void
    {
        $seen = array_fill_keys(array_map([self::class, 'sentenceKey'], $existing), true);
        foreach ($additions as $line) {
            $key = self::sentenceKey($line);
            if (isset($seen[$key])) {
                throw new InvalidArgumentException('Duplicate sentence in this lesson or the submitted text: ' . $line);
            }
            $seen[$key] = true;
        }
    }

    public function create(string $name): string
    {
        $file = trim($name) . '.txt';
        $path = $this->path($file);
        if (file_exists($path)) {
            throw new InvalidArgumentException('This lesson already exists.');
        }
        $handle = fopen($path, 'x');
        if ($handle === false) {
            throw new RuntimeException('Unable to create the lesson. Check write permissions for the lessons folder.');
        }
        fclose($handle);
        return $file;
    }

    public function change(string $file, string $action, array $data): ?string
    {
        $path = $this->path($file);
        if (!is_file($path)) {
            throw new InvalidArgumentException('This lesson no longer exists. Please reload lessons.');
        }
        $handle = fopen($path, 'r+b');
        if ($handle === false) {
            throw new RuntimeException('Unable to save the lesson. Check file write permissions.');
        }
        try {
            if (!flock($handle, LOCK_EX)) {
                throw new RuntimeException('Unable to lock the lesson file.');
            }
            $content = stream_get_contents($handle);
            if ($content === false) {
                throw new RuntimeException('Unable to read the lesson.');
            }
            if (!in_array($action, ['append', 'replaceSentence'], true) && ($data['revision'] ?? null) !== hash('sha256', $content)) {
                throw new UnexpectedValueException('The file has changed. Reload the lesson before editing or deleting it.');
            }
            if ($action === 'delete') {
                if (!unlink($path)) {
                    throw new RuntimeException('Unable to delete the lesson.');
                }
                return null;
            }
            if ($action === 'rename') {
                if (!is_string($data['name'] ?? null)) {
                    throw new InvalidArgumentException('Invalid lesson name.');
                }
                $newFile = trim($data['name']) . '.txt';
                $newPath = $this->path($newFile);
                if ($path === $newPath) {
                    return $file;
                }
                // link is exclusive: never overwrite an existing lesson on rename.
                if (!link($path, $newPath)) {
                    throw new RuntimeException('This lesson name already exists, or the file could not be renamed.');
                }
                if (!unlink($path)) {
                    unlink($newPath);
                    throw new RuntimeException('Unable to rename the lesson.');
                }
                return $newFile;
            }
            if ($action === 'append') {
                if (!is_string($data['text'] ?? null) || strlen($data['text']) > 100000) {
                    throw new InvalidArgumentException('The content is invalid or exceeds 100 KB.');
                }
                $lines = self::lines($data['text']);
                if (!$lines) {
                    throw new InvalidArgumentException('Enter at least one sentence.');
                }
                self::assertUniqueAdditions(self::lines($content), $lines);
                $newContent = $content . ($content !== '' && !preg_match('/[\r\n]\z/', $content) ? "\n" : '') . implode("\n", $lines) . "\n";
            } elseif ($action === 'replaceSentence') {
                if (!is_string($data['oldText'] ?? null) || !is_string($data['text'] ?? null)
                    || strlen($data['text']) > 100000 || strpbrk($data['text'], "\r\n") !== false
                    || trim($data['text']) === '') {
                    throw new InvalidArgumentException('Enter exactly one sentence. It cannot be empty or contain line breaks.');
                }
                $lines = self::lines($content);
                $matches = array_keys($lines, $data['oldText'], true);
                if (count($matches) !== 1) {
                    throw new UnexpectedValueException(count($matches) === 0
                        ? 'The original sentence was not found. The file may have changed; reload the lesson.'
                        : 'The original sentence occurs more than once. Resolve duplicate sentences in the file before editing.');
                }
                $newText = trim($data['text']);
                unset($lines[$matches[0]]);
                self::assertUniqueAdditions($lines, [$newText]);
                // Replace the exact old sentence, preserving other lines, BOM and line endings.
                $parts = preg_split('/(\r\n|\n|\r)/', $content, -1, PREG_SPLIT_DELIM_CAPTURE);
                for ($i = 0; $i < count($parts); $i += 2) {
                    $bom = $i === 0 && str_starts_with($parts[$i], "\xEF\xBB\xBF") ? "\xEF\xBB\xBF" : '';
                    if (trim(substr($parts[$i], strlen($bom))) === $data['oldText']) {
                        $parts[$i] = $bom . $newText;
                        break;
                    }
                }
                $newContent = implode('', $parts);
            } elseif ($action === 'removeSentence') {
                $lines = self::lines($content);
                $index = $data['index'] ?? null;
                if (!is_int($index) || !array_key_exists($index, $lines)) {
                    throw new InvalidArgumentException('The sentence to delete was not found.');
                }
                array_splice($lines, $index, 1);
                $newContent = $lines ? implode("\n", $lines) . "\n" : '';
            } else {
                throw new InvalidArgumentException('Invalid action.');
            }
            if (strlen($newContent) > 1000000) {
                throw new InvalidArgumentException('The lesson exceeds the 1 MB limit.');
            }
            rewind($handle);
            if (fwrite($handle, $newContent) !== strlen($newContent) || !ftruncate($handle, strlen($newContent)) || !fflush($handle)) {
                throw new RuntimeException('Unable to save the complete lesson content.');
            }
            return $file;
        } finally {
            flock($handle, LOCK_UN);
            fclose($handle);
        }
    }
}
