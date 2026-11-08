<?php

require_once __DIR__ . '/../PracticeApi.php';

englishPracticeApi(true, static function (): void {
    require_once __DIR__ . '/ListeningTransfers.php';
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    header('X-Content-Type-Options: nosniff');
    ini_set('display_errors', '0');
    if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
        header('Allow: POST');
        http_response_code(405);
        echo json_encode(['error' => 'Use POST to add the current sentence to Speaking.']);
        return;
    }
    try {
        session_name('english_listening');
        if (!session_start(['cookie_httponly' => true, 'cookie_samesite' => 'Strict',
            'cookie_secure' => !empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off',
            'cookie_path' => rtrim(dirname($_SERVER['SCRIPT_NAME']), '/') . '/'])) {
            throw new RuntimeException('Session storage is unavailable.');
        }
        $csrf = $_SESSION['csrf'] ?? null;
        session_write_close();
        if (!is_string($csrf) || !is_string($_SERVER['HTTP_X_CSRF_TOKEN'] ?? null) || !hash_equals($csrf, $_SERVER['HTTP_X_CSRF_TOKEN'])) {
            http_response_code(403);
            echo json_encode(['error' => 'Your session expired. Reload Listening and try again.']);
            return;
        }
        $raw = file_get_contents('php://input', false, null, 0, 4097);
        if ($raw === false || strlen($raw) > 4096) {
            throw new InvalidArgumentException('The request is too large.');
        }
        $request = json_decode($raw, true, 8, JSON_THROW_ON_ERROR);
        if (!is_array($request) || array_diff(array_keys($request), ['lesson', 'revision', 'index'])) {
            throw new InvalidArgumentException('Provide the source lesson, revision and sentence index only.');
        }
        $sentence = listeningTransferSource(englishDataPath('Listening/lessons'), $request);
        $added = listeningAppendSpeaking(englishDataPath('Speaking/lessons'), $sentence);
        echo json_encode(['added' => $added, 'file' => 'From Listening.txt']);
    } catch (InvalidArgumentException | JsonException $error) {
        http_response_code(400);
        echo json_encode(['error' => 'Invalid request. Reload Listening and select an available sentence.']);
    } catch (UnexpectedValueException $error) {
        http_response_code(409);
        echo json_encode(['error' => $error->getMessage()]);
    } catch (Throwable $error) {
        http_response_code(500);
        echo json_encode(['error' => 'Unable to save the sentence. Check the Speaking lesson file permissions and try again.']);
    }
});
