<?php

require_once __DIR__ . '/../PracticeApi.php';

englishPracticeApi(true, static function (): void {
    require_once __DIR__ . '/AcceptedWords.php';

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
        $words = new AcceptedWords(englishDataPath('Speaking/settings/accepted-words.txt'));
        $method = $_SERVER['REQUEST_METHOD'];
        if ($method === 'POST') {
            if (!hash_equals($csrf, $_SERVER['HTTP_X_CSRF_TOKEN'] ?? '')) {
                http_response_code(403);
                echo json_encode(['error' => 'Your session has expired. Please reload this page.']);
                return;
            }
            $raw = file_get_contents('php://input', false, null, 0, 110000);
            $data = json_decode($raw, true, 16, JSON_THROW_ON_ERROR);
            if (!is_array($data) || !is_string($data['text'] ?? null) || !is_string($data['revision'] ?? null)) {
                throw new InvalidArgumentException('Invalid word list request.');
            }
            $result = $words->save($data['text'], $data['revision']);
        } elseif ($method === 'GET') {
            $result = $words->read();
        } else {
            header('Allow: GET, POST');
            http_response_code(405);
            echo json_encode(['error' => 'Only GET and POST requests are supported.']);
            return;
        }
        echo json_encode($result + ['csrf' => $csrf], JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE);
    } catch (UnexpectedValueException $e) {
        http_response_code(409);
        echo json_encode(['error' => $e->getMessage()]);
    } catch (InvalidArgumentException | JsonException $e) {
        http_response_code(400);
        echo json_encode(['error' => $e instanceof JsonException ? 'Invalid JSON.' : $e->getMessage()]);
    } catch (Throwable $e) {
        http_response_code(500);
        echo json_encode(['error' => 'Unable to read or save accepted words. Check the settings folder permissions and word list format.']);
    }
});
