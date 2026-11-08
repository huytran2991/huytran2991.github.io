<?php

require_once __DIR__ . '/../PracticeApi.php';

englishPracticeApi(true, static function (): void {
    require_once __DIR__ . '/LessonFiles.php';
    require_once __DIR__ . '/SpeakingState.php';

    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    header('X-Content-Type-Options: nosniff');
    ini_set('display_errors', '0');
    session_name('english_speaking');
    session_start([
        'cookie_httponly' => true,
        'cookie_samesite' => 'Strict',
        'cookie_secure' => !empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off',
        'cookie_path' => rtrim(dirname($_SERVER['SCRIPT_NAME']), '/') . '/',
    ]);
    $_SESSION['csrf'] = $_SESSION['csrf'] ?? bin2hex(random_bytes(32));
    $csrf = $_SESSION['csrf'];
    session_write_close();

    try {
        $lessons = new LessonFiles(englishDataPath('Speaking/lessons'));
        $method = $_SERVER['REQUEST_METHOD'];
        $data = [];
        if ($method === 'POST') {
            if (!hash_equals($csrf, $_SERVER['HTTP_X_CSRF_TOKEN'] ?? '')) {
                http_response_code(403);
                echo json_encode(['error' => 'Your session has expired. Please reload this page.']);
                return;
            }
            $limit = 110000;
            $raw = file_get_contents('php://input', false, null, 0, $limit + 1);
            if ($raw === false || strlen($raw) > $limit) {
                throw new InvalidArgumentException('Request is too large.');
            }
            $data = json_decode($raw, true, 16, JSON_THROW_ON_ERROR);
            if (!is_array($data) || !is_string($data['action'] ?? null)) {
                throw new InvalidArgumentException('Invalid request.');
            }
        } elseif ($method !== 'GET') {
            header('Allow: GET, POST');
            http_response_code(405);
            echo json_encode(['error' => 'Only GET and POST requests are supported.']);
            return;
        }

        $state = new SpeakingState(englishDataPath('data/speaking'));
        $result = $state->locked(static function () use ($state, $lessons, $data, $method): array {
            if ($method === 'GET') {
                if (isset($_GET['progress'])) {
                    if (!is_string($_GET['progress'])) {
                        throw new InvalidArgumentException('Invalid lesson file.');
                    }
                    $lesson = $lessons->get($_GET['progress']);
                    if ($lesson === null || ($_GET['revision'] ?? null) !== $lesson['revision']) {
                        throw new UnexpectedValueException('The lesson has changed. Reload it to see its progress.');
                    }
                    return ['progress' => $state->progress($lesson)];
                }
                return ['lessons' => $lessons->all(), 'selected' => null, 'config' => $state->config(),
                    'completed' => $state->summary()];
            }

            $action = $data['action'];
            if ($action === 'saveConfig') {
                if (!is_array($data['config'] ?? null)) {
                    throw new InvalidArgumentException('Invalid settings.');
                }
                return ['config' => $state->saveConfig($data['config'])];
            }
            if ($action === 'create') {
                if (!is_string($data['name'] ?? null)) {
                    throw new InvalidArgumentException('Invalid lesson name.');
                }
                $selected = $lessons->create($data['name']);
            } else {
                $file = $data['file'] ?? null;
                if (!is_string($file)) {
                    throw new InvalidArgumentException('Invalid lesson file.');
                }
                if (in_array($action, ['attempt', 'resetCount', 'setStar'], true)) {
                    $lesson = $lessons->get($file);
                    if ($lesson === null) {
                        throw new UnexpectedValueException('This lesson no longer exists. Reload the lesson list.');
                    }
                    return ['progress' => $state->update($lesson, $data)];
                }
                if ($action === 'delete' || $action === 'rename') {
                    if ($lessons->get($file) === null) {
                        throw new InvalidArgumentException('This lesson no longer exists.');
                    }
                    $newFile = null;
                    if ($action === 'rename') {
                        if (!is_string($data['name'] ?? null)) {
                            throw new InvalidArgumentException('Invalid lesson name.');
                        }
                        $newFile = trim($data['name']) . '.txt';
                        if ($newFile !== $file && $lessons->get($newFile) !== null) {
                            throw new InvalidArgumentException('This lesson name already exists.');
                        }
                    }
                    $selected = $state->changeLessonFile($file, $newFile, static fn() => $lessons->change($file, $action, $data));
                } else {
                    $selected = $lessons->change($file, $action, $data);
                    $lesson = $lessons->get($file);
                    if ($lesson !== null) {
                        $state->refreshCompletion($lesson);
                    }
                }
            }
            return ['lessons' => $lessons->all(), 'selected' => $selected, 'completed' => $state->summary()];
        });
        echo json_encode($result + ['csrf' => $csrf], JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE);
    } catch (UnexpectedValueException $e) {
        http_response_code(409);
        echo json_encode(['error' => $e->getMessage()]);
    } catch (InvalidArgumentException | JsonException $e) {
        http_response_code(400);
        echo json_encode(['error' => $e instanceof JsonException ? 'Invalid JSON.' : $e->getMessage()]);
    } catch (Throwable $e) {
        http_response_code(500);
        echo json_encode(['error' => 'Unable to read or save Speaking data. Check your Firestore connection and try again.']);
    }
});
