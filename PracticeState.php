<?php

/** File-backed progress for the standalone Listening and Writing tools. */
final class PracticeState
{
    public function __construct(private string $directory, private string $complete)
    {
        if (!is_dir($directory . '/progress')) {
            throw new RuntimeException('Practice data directory is unavailable.');
        }
    }

    public function run(array $request, callable $findLesson, callable $checkAcceptance, callable $validateConfig): array
    {
        $lock = fopen($this->directory . '/state.lock', 'c');
        if ($lock === false) {
            throw new RuntimeException('Unable to open the practice data lock.');
        }
        try {
            if (!flock($lock, LOCK_EX)) {
                throw new RuntimeException('Unable to lock practice data.');
            }
            return $this->apply($request, $findLesson, $checkAcceptance, $validateConfig);
        } finally {
            fclose($lock);
        }
    }

    private function apply(array $request, callable $findLesson, callable $checkAcceptance, callable $validateConfig): array
    {
        $action = $request['action'] ?? null;
        if ($action === 'state') {
            return ['config' => (object) $this->read('config.json'), 'summary' => (object) $this->read('completed.json')];
        }
        if ($action === 'config') {
            $changes = $request['config'] ?? null;
            if (!is_array($changes)) {
                throw new InvalidArgumentException('Invalid preferences.');
            }
            $old = $this->read('config.json');
            $changes = $validateConfig($changes);
            $next = array_replace($old, $changes);
            if ($next !== $old) {
                $this->write('config.json', $next);
            }
            return [];
        }

        $id = $request['lesson'] ?? null;
        if (!is_string($id) || strlen($id) > 4096) {
            throw new InvalidArgumentException('Invalid lesson.');
        }
        $lesson = $findLesson($id);
        if ($lesson === null) {
            throw new UnexpectedValueException('Lesson no longer exists. Reload lessons.');
        }
        if (($request['revision'] ?? null) !== $lesson['revision']) {
            throw new UnexpectedValueException('The lesson has changed. Reload lessons.');
        }
        // Hash the full relative path. A short readable label helps locate the JSON on disk.
        $label = substr(preg_replace('/[^a-zA-Z0-9 _.-]/', '_', basename($id, '.txt')), 0, 90);
        $file = 'progress/' . $label . '--' . hash('sha256', $id) . '.json';
        $old = $this->read($file)['results'] ?? [];
        $results = array_intersect_key($old, $lesson['keys']);
        switch ($action) {
            case 'lesson':
                break;
            case 'clear':
                $results = [];
                break;
            case 'mark':
                $key = $request['sentence'] ?? null;
                $value = $request['result'] ?? null;
                if (!is_string($key) || !isset($lesson['keys'][$key])) {
                    throw new InvalidArgumentException('Invalid sentence.');
                }
                if ($this->complete === 'ai') {
                    $checkAcceptance($request, $lesson);
                    $results[$key] = 'ai';
                } elseif ($value === 'correct' || $value === 'viewed') {
                    if (($results[$key] ?? null) !== 'correct') {
                        $results[$key] = $value;
                    }
                } else {
                    throw new InvalidArgumentException('Invalid dictation result.');
                }
                break;
            default:
                throw new InvalidArgumentException('Invalid practice action.');
        }
        if ($action !== 'lesson' && $results !== $old) {
            $data = ['lesson' => $id, 'results' => (object) $results];
            if ($this->complete === 'ai') {
                $data['sentences'] = (object) array_intersect_key($lesson['keys'], $results);
            }
            $this->write($file, $data);
        }
        $done = count(array_filter($results, fn($value) => $value === $this->complete));
        $summary = $this->read('completed.json');
        if (($summary[$id] ?? null) !== ['revision' => $lesson['revision'], 'done' => $done]) {
            $summary[$id] = ['revision' => $lesson['revision'], 'done' => $done];
            $this->write('completed.json', $summary);
        }
        return ['results' => (object) $results, 'done' => $done];
    }

    private function read(string $name): array
    {
        $path = $this->directory . '/' . $name;
        clearstatcache(true, $path);
        if (!is_file($path)) {
            return [];
        }
        $raw = file_get_contents($path);
        if ($raw === false) {
            throw new RuntimeException('Unable to read practice data.');
        }
        try {
            $data = json_decode($raw, true, 16, JSON_THROW_ON_ERROR);
        } catch (JsonException $error) {
            throw new RuntimeException('Invalid practice data file.', 0, $error);
        }
        if (!is_array($data)) {
            throw new RuntimeException('Invalid practice data file.');
        }
        return $data;
    }

    private function write(string $name, array $data): void
    {
        $path = $this->directory . '/' . $name;
        $json = json_encode($data, JSON_THROW_ON_ERROR | JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE) . "\n";
        $temporary = tempnam(dirname($path), '.practice-');
        if ($temporary === false) {
            throw new RuntimeException('Unable to create practice data file.');
        }
        try {
            if (dirname($temporary) !== dirname($path) || file_put_contents($temporary, $json) !== strlen($json)
                || !chmod($temporary, 0660) || !rename($temporary, $path)) {
                throw new RuntimeException('Unable to save practice data.');
            }
        } finally {
            if (is_file($temporary)) {
                unlink($temporary);
            }
        }
    }
}

function practiceReply(string $tool, string $complete, string $csrf, callable $findLesson, callable $accept, callable $config): void
{
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    header('X-Content-Type-Options: nosniff');
    ini_set('display_errors', '0');
    try {
        $token = $_SERVER['HTTP_X_CSRF_TOKEN'] ?? null;
        if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
            header('Allow: POST');
            http_response_code(405);
            $result = ['error' => 'Use POST for practice data.'];
        } elseif ($csrf === '' || !is_string($token) || !hash_equals($csrf, $token)) {
            http_response_code(403);
            $result = ['error' => 'Your session has expired. Reload lessons.'];
        } else {
            $limit = 8 * 1024 * 1024;
            $raw = file_get_contents('php://input', false, null, 0, $limit + 1);
            if ($raw === false || strlen($raw) > $limit) {
                throw new InvalidArgumentException('Practice request is too large.');
            }
            $request = json_decode($raw, true, 16, JSON_THROW_ON_ERROR);
            if (!is_array($request)) {
                throw new InvalidArgumentException('Invalid practice request.');
            }
            $dir = englishDataPath('data/' . $tool);
            $result = (new PracticeState($dir, $complete))->run($request, $findLesson, $accept, $config);
        }
    } catch (UnexpectedValueException $error) {
        http_response_code(409);
        $result = ['error' => $error->getMessage()];
    } catch (InvalidArgumentException | JsonException $error) {
        http_response_code(400);
        $result = ['error' => $error instanceof JsonException ? 'Invalid JSON.' : $error->getMessage()];
    } catch (Throwable $error) {
        http_response_code(500);
        $result = ['error' => 'Unable to load or save practice data. Check data directory permissions.'];
    }
    echo json_encode((object) $result, JSON_INVALID_UTF8_SUBSTITUTE | JSON_UNESCAPED_UNICODE);
}
