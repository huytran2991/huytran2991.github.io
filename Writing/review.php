<?php

require_once __DIR__ . '/../PracticeApi.php';

englishPracticeApi(false, static function (): void {
    require_once __DIR__ . '/WritingSupport.php';
    require_once __DIR__ . '/WritingTransfers.php';
    writingHeaders();
    if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
        header('Allow: POST');
        writingReply(['error' => 'Use POST to request a review.'], 405);
        return;
    }
    try {
        writingSession();
        $token = $_SERVER['HTTP_X_CSRF_TOKEN'] ?? null;
        if (!is_string($token) || !hash_equals($_SESSION['csrf'], $token)) {
            session_write_close();
            writingReply(['error' => 'Your session expired. Reload lessons and try again.'], 403);
            return;
        }
        $raw = file_get_contents('php://input', false, null, 0, 16385);
        if ($raw === false || strlen($raw) > 16384) {
            throw new InvalidArgumentException('The review request is too large.');
        }
        $request = json_decode($raw, true, 16, JSON_THROW_ON_ERROR);
        if (!is_array($request)) {
            throw new InvalidArgumentException('Invalid review request.');
        }
        $model = writingModel(array_key_exists('model', $request) ? $request['model'] : WRITING_MODEL);
        $sentence = writingReviewTarget(writingLessons(englishDataPath('Writing/lessons')), $request);
        $key = writingApiKey();
        if ($key === '' || !extension_loaded('curl')) {
            session_write_close();
            writingReply(['error' => 'AI is unavailable. Check the server credential and reload lessons.', 'retryable' => false], 503);
            return;
        }
        $now = time();
        $calls = array_values(array_filter($_SESSION['review_calls'] ?? [], static fn(int $at): bool => $at > $now - 3600));
        if (count($calls) >= 100 || ($calls && $now - end($calls) < 3)) {
            session_write_close();
            writingReply(['error' => 'Too many reviews. Wait a moment and try again.'], 429);
            return;
        }
        $calls[] = $now;
        $_SESSION['review_calls'] = $calls;
        session_write_close(); // Navigation and other tabs stay responsive during the vendor call.
        $review = writingCallAI(writingPrompt($sentence, trim($request['answer'])), $key, $model);
        writingSession();
        $transferToken = writingRememberAccepted($review, $request);
        session_write_close();
        writingReply(['review' => $review, 'model' => $model, 'transferToken' => $transferToken]);
    } catch (JsonException | InvalidArgumentException $error) {
        if (session_status() === PHP_SESSION_ACTIVE) { session_write_close(); }
        writingReply(['error' => 'Invalid request. Choose an available model and supply a valid lesson, sentence and nonempty answer (at most 2,000 bytes).'], 400);
    } catch (UnexpectedValueException $error) {
        if (session_status() === PHP_SESSION_ACTIVE) { session_write_close(); }
        writingReply(['error' => $error->getMessage()], 409);
    } catch (Throwable $error) {
        if (session_status() === PHP_SESSION_ACTIVE) { session_write_close(); }
        writingReply(writingReviewError($error), 502);
    }
});
