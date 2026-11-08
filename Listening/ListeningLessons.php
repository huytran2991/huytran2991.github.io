<?php

function listeningLessons(string $directory, ?string $only = null): array
{
    $lessons = [];
    $paths = [];
    $files = new RecursiveIteratorIterator(new RecursiveDirectoryIterator($directory, FilesystemIterator::SKIP_DOTS));
    foreach ($files as $file) {
        if ($file->isFile() && !$file->isLink() && strtolower($file->getExtension()) === 'txt'
            && ($only === null || substr($file->getPathname(), strlen($directory) + 1) === $only)) {
            $paths[] = $file->getPathname();
        }
    }
    natcasesort($paths);
    foreach ($paths as $path) {
        if (!is_file($path) || is_link($path)) {
            continue;
        }
        $handle = fopen($path, 'rb');
        if ($handle === false) {
            throw new RuntimeException('Unable to read a lesson. Check file permissions.');
        }
        try {
            if (!flock($handle, LOCK_SH)) {
                throw new RuntimeException('Unable to lock a lesson.');
            }
            $content = stream_get_contents($handle);
            if ($content === false) {
                throw new RuntimeException('Unable to read a lesson.');
            }
        } finally {
            flock($handle, LOCK_UN);
            fclose($handle);
        }
        $revision = hash('sha256', $content);
        $original = $content;
        $content = preg_replace('/\A\xEF\xBB\xBF/', '', $content);
        $lines = array_values(array_filter(array_map('trim', preg_split('/\r\n|\r|\n/', $content)), static fn($line) => $line !== ''));
        // Relative paths separate equal filenames in different stages; root IDs stay unchanged.
        $relative = substr($path, strlen($directory) + 1);
        $lessons[] = ['id' => $relative, 'name' => substr($relative, 0, -4), 'lines' => $lines, 'content' => $original, 'revision' => $revision];
    }
    return $lessons;
}
