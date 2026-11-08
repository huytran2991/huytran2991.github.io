<?php

require_once __DIR__ . '/../PracticeApi.php';

englishPracticeApi(true, static function (): void {
    require_once __DIR__ . '/WritingSupport.php';
    writingHeaders();
    $method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
    if (!in_array($method, ['GET', 'POST'], true)) {
        header('Allow: GET, POST');
        writingReply(['error' => 'Use GET to load lessons or POST to create a lesson.'], 405);
        return;
    }
    try {
        writingSession();
        $csrf = $_SESSION['csrf'];
        session_write_close();
        if ($method === 'POST') {
            $token = $_SERVER['HTTP_X_CSRF_TOKEN'] ?? null;
            if (!is_string($token) || !hash_equals($csrf, $token)) {
                writingReply(['error' => 'Your session expired. Reload lessons and try again.'], 403);
                return;
            }
            $raw = file_get_contents('php://input', false, null, 0, 7 * 1024 * 1024 + 1);
            if ($raw === false || strlen($raw) > 7 * 1024 * 1024) {
                throw new InvalidArgumentException('The lesson request is too large.');
            }
            $request = json_decode($raw, true, 16, JSON_THROW_ON_ERROR);
            if (!is_array($request) || ($request['action'] ?? null) !== 'create') {
                throw new InvalidArgumentException('Use the create action to add a lesson.');
            }
            $selected = writingCreateLesson(englishDataPath('Writing/lessons'), $request);
            writingReply(['selected' => $selected]);
            return;
        }
        writingReply(['lessons' => writingLessons(englishDataPath('Writing/lessons')), 'csrf' => $csrf,
            'aiAvailable' => writingApiKey() !== '' && extension_loaded('curl'), 'model' => WRITING_MODEL,
            'models' => writingModels()]);
    } catch (UnexpectedValueException $error) {
        writingReply(['error' => $error->getMessage()], 409);
    } catch (InvalidArgumentException | JsonException $error) {
        writingReply(['error' => $error instanceof JsonException ? 'Invalid JSON.' : $error->getMessage()], 400);
    } catch (Throwable $error) {
        writingReply(['error' => 'Unable to load or create lessons. Check the UTF-8 lesson text and folder permissions.'], 500);
    }
});
