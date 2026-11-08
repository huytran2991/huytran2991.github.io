<?php

require_once __DIR__ . '/../PracticeApi.php';

englishPracticeApi(true, static function (): void {
    require_once __DIR__ . '/../PracticeState.php';
    require_once __DIR__ . '/ListeningLessons.php';

    session_name('english_listening');
    ini_set('display_errors', '0');
    session_start([
        'cookie_httponly' => true,
        'cookie_samesite' => 'Strict',
        'cookie_secure' => !empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off',
        'cookie_path' => rtrim(dirname($_SERVER['SCRIPT_NAME']), '/') . '/',
    ]);
    $csrf = $_SESSION['csrf'] ?? '';
    session_write_close();

    practiceReply('listening', 'correct', $csrf, static function (string $id): ?array {
        foreach (listeningLessons(englishDataPath('Listening/lessons'), $id) as $lesson) {
            $occurrences = [];
            $keys = [];
            foreach ($lesson['lines'] as $text) {
                $count = $occurrences[$text] ?? 0;
                $key = json_encode([$text, $count], JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_LINE_TERMINATORS);
                $keys[$key] = true;
                $occurrences[$text] = $count + 1;
            }
            return $lesson + ['keys' => $keys];
        }
        return null;
    }, static function (): void {}, static function (array $config): array {
        $valid = [];
        foreach (['voice', 'rate', 'lesson', 'lessonSearch'] as $key) {
            if (is_string($config[$key] ?? null) && strlen($config[$key]) <= 4096) {
                $valid[$key] = $config[$key];
            }
        }
        if (array_key_exists('selection', $config)
            && ($config['selection'] === null || (is_string($config['selection']) && strlen($config['selection']) <= 2 * 1024 * 1024))) {
            $valid['selection'] = $config['selection'];
        }
        return $valid;
    });
});
