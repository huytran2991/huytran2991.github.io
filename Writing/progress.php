<?php

require_once __DIR__ . '/../PracticeApi.php';

englishPracticeApi(true, static function (): void {
    require_once __DIR__ . '/../PracticeState.php';
    require_once __DIR__ . '/WritingSupport.php';

    writingHeaders();
    try {
        writingSession();
    } catch (RuntimeException $error) {
        writingReply(['error' => 'Session storage is unavailable.'], 500);
        return;
    }
    $csrf = $_SESSION['csrf'];
    $receipts = $_SESSION['writing_transfers'] ?? [];
    session_write_close();

    practiceReply('writing', 'ai', $csrf, static function (string $id): ?array {
        foreach (writingLessons(englishDataPath('Writing/lessons'), $id) as $lesson) {
            if ($lesson['id'] === $id) {
                return $lesson + ['keys' => array_column($lesson['sentences'], 'vi', 'id')];
            }
        }
        return null;
    }, static function (array $request, array $lesson) use ($receipts): void {
        $token = $request['receipt'] ?? null;
        $record = is_string($token) ? ($receipts[$token] ?? null) : null;
        if (!$record || $record['expires'] <= time() || $record['lesson'] !== $lesson['id']
            || $record['revision'] !== $lesson['revision'] || $record['sentence'] !== $request['sentence']) {
            throw new UnexpectedValueException('Review this translation successfully before saving completion.');
        }
    }, static function (array $config): array {
        $valid = [];
        if (is_string($config['model'] ?? null) && isset(writingModels()[$config['model']])) {
            $valid['model'] = $config['model'];
        }
        if (is_string($config['lessonSearch'] ?? null) && strlen($config['lessonSearch']) <= 4096) {
            $valid['lessonSearch'] = $config['lessonSearch'];
        }
        $selection = $config['selection'] ?? null;
        if (is_array($selection) && is_string($selection['lessonId'] ?? null) && strlen($selection['lessonId']) <= 4096
            && array_key_exists('sentenceId', $selection)
            && ($selection['sentenceId'] === null || (is_string($selection['sentenceId']) && strlen($selection['sentenceId']) <= 128))) {
            $valid['selection'] = ['lessonId' => $selection['lessonId'], 'sentenceId' => $selection['sentenceId']];
        }
        return $valid;
    });
});
