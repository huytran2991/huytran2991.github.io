<?php

require_once __DIR__ . '/../PracticeApi.php';

englishPracticeApi(false, static function (): void {
    require_once __DIR__ . '/ReviewSupport.php';
    writingHeaders();
    try {
        speakingReviewSession();
        $csrf = $_SESSION['csrf'];
        session_write_close();
        writingReply(['csrf' => $csrf, 'prompts' => speakingReviewPrompts(englishDataPath('SpeakingReview/prompts')),
            'models' => speakingReviewModels(), 'maxBytes' => SPEAKING_REVIEW_MAX_BYTES,
            'available' => writingApiKey() !== '' && extension_loaded('curl') && extension_loaded('fileinfo')]);
    } catch (Throwable $error) {
        writingReply(['error' => 'Cannot load review settings. Check the prompt files and server configuration.'], 503);
    }
});
