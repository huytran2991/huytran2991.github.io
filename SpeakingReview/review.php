<?php

require_once __DIR__ . '/../PracticeApi.php';

englishPracticeApi(false, static function (): void {
    require_once __DIR__ . '/ReviewSupport.php';
    writingHeaders();
    if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
        header('Allow: POST');
        writingReply(['error' => 'Use POST to send audio.'], 405);
        return;
    }
    try {
        speakingReviewSession();
        $token = $_SERVER['HTTP_X_CSRF_TOKEN'] ?? null;
        if (!is_string($token) || !hash_equals($_SESSION['csrf'], $token)) {
            writingReply(['error' => 'Your session expired or the upload exceeded the server limit. Reload prompts and try again.'], 403);
            return;
        }
        $prompt = speakingReviewTarget(speakingReviewPrompts(englishDataPath('SpeakingReview/prompts')), $_POST);
        $upload = $_FILES['audio'] ?? null;
        if (!is_array($upload) || ($upload['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK
            || !is_string($upload['tmp_name'] ?? null) || !is_uploaded_file($upload['tmp_name'])) {
            throw new InvalidArgumentException('Audio upload failed. Check the file size and PHP upload limits.');
        }
        $audio = speakingReviewAudio($upload['tmp_name'], (int) ($upload['size'] ?? 0));
        $key = writingApiKey();
        if ($key === '' || !extension_loaded('curl')) {
            writingReply(['error' => 'AI is unavailable. Configure the Writing API key and PHP cURL.'], 503);
            return;
        }
        $now = time();
        $calls = array_values(array_filter($_SESSION['review_calls'] ?? [], static fn(int $at): bool => $at > $now - 3600));
        if (count($calls) >= 60 || ($calls && $now - end($calls) < 3)) {
            writingReply(['error' => 'Too many requests. Wait before sending again (60 reviews per hour).'], 429);
            return;
        }
        $calls[] = $now;
        $_SESSION['review_calls'] = $calls;
        session_write_close();
        $text = speakingReviewCall(speakingReviewPayload($prompt['text'], $audio), $key, $_POST['model']);
        writingReply(['review' => $text, 'model' => $_POST['model'], 'prompt' => $prompt['title']]);
    } catch (InvalidArgumentException $error) {
        writingReply(['error' => $error->getMessage()], 400);
    } catch (UnexpectedValueException $error) {
        writingReply(['error' => $error->getMessage()], 409);
    } catch (Throwable $error) {
        $message = $error instanceof RuntimeException && str_starts_with($error->getMessage(), 'AI ')
            ? $error->getMessage() : 'Unable to review this recording. Check the server configuration.';
        writingReply(['error' => $message], $error->getCode() === 429 ? 429 : 502);
    } finally {
        if (session_status() === PHP_SESSION_ACTIVE) { session_write_close(); }
    }
});
