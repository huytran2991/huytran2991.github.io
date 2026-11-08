<?php

declare(strict_types=1);

require_once __DIR__ . '/FirestorePracticeStore.php';

function englishDataPath(string $relative): string
{
    return ENGLISH_REQUEST_DATA . '/' . $relative;
}

function englishRemoveSnapshot(string $directory): void
{
    $iterator = new RecursiveIteratorIterator(
        new RecursiveDirectoryIterator($directory, FilesystemIterator::SKIP_DOTS),
        RecursiveIteratorIterator::CHILD_FIRST
    );
    foreach ($iterator as $entry) {
        if ($entry->isDir() && !$entry->isLink()) {
            rmdir($entry->getPathname());
        } else {
            unlink($entry->getPathname());
        }
    }
    rmdir($directory);
}

function englishPracticeApi(bool $canWrite, Closure $handler): void
{
    ini_set('display_errors', '0');
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    header('X-Content-Type-Options: nosniff');
    $writing = $canWrite && ($_SERVER['REQUEST_METHOD'] ?? '') === 'POST';
    $directory = null;
    ob_start();
    try {
        $store = new FirestorePracticeStore($_SERVER['HTTP_X_ENGLISH_ID_TOKEN'] ?? '');
        $snapshot = $store->read();
        if ($snapshot === null) {
            throw new RuntimeException('English Practice data has not been imported into Firestore.');
        }
        $files = $snapshot['files'];

        // Request-local snapshot so existing revisions and file-based validations keep their semantics.
        $path = sys_get_temp_dir() . '/english-practice-' . bin2hex(random_bytes(16));
        if (!mkdir($path, 0700)) {
            throw new RuntimeException('Could not prepare the practice data.');
        }
        $directory = $path;
        define('ENGLISH_REQUEST_DATA', $directory);
        foreach (FirestorePracticeStore::DIRECTORIES as $relative) {
            mkdir(englishDataPath($relative), 0700, true);
        }
        foreach ($files as $relative => $contents) {
            $file = englishDataPath($relative);
            if (!is_dir(dirname($file))) {
                mkdir(dirname($file), 0700, true);
            }
            if (file_put_contents($file, $contents) !== strlen($contents)) {
                throw new RuntimeException('Could not prepare the practice data.');
            }
        }

        $handler();
        if ($writing && (http_response_code() ?: 200) === 200) {
            $updated = FirestorePracticeStore::collect($directory);
            if ($updated !== $files) {
                $store->write($updated, $snapshot);
            }
        }
    } catch (Throwable $error) {
        ob_clean();
        http_response_code(in_array($error->getCode(), [403, 409], true) ? $error->getCode() : 503);
        echo json_encode(['error' => $error instanceof RuntimeException ? $error->getMessage() : 'English Practice storage is unavailable.']);
    } finally {
        if ($directory !== null) {
            englishRemoveSnapshot($directory);
        }
        ob_end_flush();
    }
}
