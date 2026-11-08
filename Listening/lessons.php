<?php

require_once __DIR__ . '/../PracticeApi.php';

englishPracticeApi(true, static function (): void {
    require_once __DIR__ . '/ListeningLessons.php';

    // Standalone lesson editing; no LoanFX bootstrap or database.
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    header('X-Content-Type-Options: nosniff');
    ini_set('display_errors', '0');
    // CLI listing is also used by the filesystem tests.
    $method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
    $csrf = null;
    if (PHP_SAPI !== 'cli') {
        session_name('english_listening');
        session_start([
            'cookie_httponly' => true,
            'cookie_samesite' => 'Strict',
            'cookie_secure' => !empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off',
            'cookie_path' => rtrim(dirname($_SERVER['SCRIPT_NAME']), '/') . '/',
        ]);
        $_SESSION['csrf'] = $_SESSION['csrf'] ?? bin2hex(random_bytes(32));
        $csrf = $_SESSION['csrf'];
        session_write_close();
    }

    function saveListeningLesson(string $directory, array $data): string
    {
        $action = $data['action'] ?? null;
        $file = $data['file'] ?? null;
        $content = $data['content'] ?? null;
        if (!in_array($action, ['create', 'update'], true) || !is_string($file) || !is_string($content)) {
            throw new InvalidArgumentException('Provide an action, file name and content.');
        }
        if (strlen($content) > 2 * 1024 * 1024 || !preg_match('//u', $content) || strpos($content, "\0") !== false || trim($content, " \t\r\n") === '') {
            throw new InvalidArgumentException('Enter nonempty UTF-8 content, at most 2 MB.');
        }
        $parts = explode('/', $file);
        if (strlen($file) > 1024 || !preg_match('/\.txt\z/i', $file)) {
            throw new InvalidArgumentException('Use a .txt file name.');
        }
        if ($action === 'create' && (count($parts) !== 1 || strlen($file) > 180 || !preg_match('/\A[\p{L}\p{N}][\p{L}\p{N} _().-]*\.txt\z/ui', $file))) {
            throw new InvalidArgumentException('Use a file name beginning with a letter or number, without folders.');
        }
        $path = $directory;
        foreach ($parts as $part) {
            if ($part === '' || $part === '.' || $part === '..' || preg_match('/[\x00-\x1f\x7f\\\\]/', $part)) {
                throw new InvalidArgumentException('Invalid lesson path.');
            }
            $path .= '/' . $part;
            if (is_link($path)) {
                throw new InvalidArgumentException('Symbolic links are not supported.');
            }
        }
        if ($action === 'update' && (!is_file($path) || realpath($path) !== $path)) {
            throw new InvalidArgumentException('Lesson not found. Reload the lesson list.');
        }
        if ($action === 'create' && file_exists($path)) {
            throw new UnexpectedValueException('A lesson with this file name already exists.');
        }
        $handle = fopen($path, $action === 'create' ? 'x+b' : 'r+b');
        if ($handle === false) {
            throw new RuntimeException('Unable to open lesson for writing.');
        }
        try {
            if (!flock($handle, LOCK_EX)) {
                throw new RuntimeException('Unable to lock lesson.');
            }
            $original = stream_get_contents($handle);
            if ($original === false) {
                throw new RuntimeException('Unable to read lesson.');
            }
            if ($action === 'update' && (!is_string($data['revision'] ?? null) || !hash_equals(hash('sha256', $original), $data['revision']))) {
                throw new UnexpectedValueException('This lesson changed elsewhere. Copy your edits, reload the lessons, then try again.');
            }
            rewind($handle);
            if (fwrite($handle, $content) !== strlen($content) || !ftruncate($handle, strlen($content)) || !fflush($handle)) {
                rewind($handle);
                fwrite($handle, $original);
                ftruncate($handle, strlen($original));
                fflush($handle);
                throw new RuntimeException('Unable to save complete lesson.');
            }
        } finally {
            flock($handle, LOCK_UN);
            fclose($handle);
        }
        return $file;
    }

    try {
        $directory = englishDataPath('Listening/lessons');
        $selected = null;
        if ($method === 'POST') {
            if (!is_string($_SERVER['HTTP_X_CSRF_TOKEN'] ?? null) || !is_string($csrf) || !hash_equals($csrf, $_SERVER['HTTP_X_CSRF_TOKEN'])) {
                http_response_code(403);
                echo json_encode(['error' => 'Your session has expired. Reload this page.']);
                return;
            }
            $raw = file_get_contents('php://input', false, null, 0, 13 * 1024 * 1024);
            $data = json_decode($raw, true, 16, JSON_THROW_ON_ERROR);
            if (!is_array($data)) {
                throw new InvalidArgumentException('Invalid request.');
            }
            $selected = saveListeningLesson(realpath($directory), $data);
        } elseif ($method !== 'GET') {
            header('Allow: GET, POST');
            http_response_code(405);
            echo json_encode(['error' => 'Only GET and POST are supported.']);
            return;
        }
        $lessons = listeningLessons($directory);
        $result = ['lessons' => $lessons];
        if ($csrf !== null) $result += ['csrf' => $csrf, 'selected' => $selected];
        echo json_encode($result, JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE);
    } catch (UnexpectedValueException $error) {
        http_response_code(409);
        echo json_encode(['error' => $error->getMessage()]);
    } catch (InvalidArgumentException | JsonException $error) {
        http_response_code(400);
        echo json_encode(['error' => $error instanceof JsonException ? 'Invalid JSON.' : $error->getMessage()]);
    } catch (Throwable $error) {
        http_response_code(500);
        echo json_encode(['error' => 'Unable to read or save lessons. Check UTF-8 text and lesson folder/file permissions.']);
    }
});
