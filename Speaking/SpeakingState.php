<?php

/** JSON state shared by the local Speaking browsers. */
final class SpeakingState
{
    public function __construct(private string $directory)
    {
        if (!is_dir($directory . '/progress')) {
            throw new RuntimeException('Speaking data directory is unavailable.');
        }
    }

    public function locked(callable $operation): mixed
    {
        $lock = fopen($this->directory . '/state.lock', 'c');
        if ($lock === false) {
            throw new RuntimeException('Unable to open the Speaking data lock.');
        }
        try {
            if (!flock($lock, LOCK_EX)) {
                throw new RuntimeException('Unable to lock Speaking data.');
            }
            return $operation();
        } finally {
            fclose($lock);
        }
    }

    private function read(string $file): array
    {
        $path = $this->directory . '/' . $file;
        if (!is_file($path)) {
            return [];
        }
        $json = file_get_contents($path);
        if ($json === false) {
            throw new RuntimeException('Unable to read Speaking data.');
        }
        try {
            $data = json_decode($json, true, 16, JSON_THROW_ON_ERROR);
        } catch (JsonException $error) {
            throw new RuntimeException('Invalid Speaking data file.', 0, $error);
        }
        if (!is_array($data)) {
            throw new RuntimeException('Invalid Speaking data file.');
        }
        return $data;
    }

    private function write(string $file, array $data): void
    {
        $path = $this->directory . '/' . $file;
        $json = json_encode($data, JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT) . "\n";
        $temporary = tempnam(dirname($path), '.speaking-');
        if ($temporary === false) {
            throw new RuntimeException('Unable to create Speaking data file.');
        }
        try {
            if (dirname($temporary) !== dirname($path)
                || file_put_contents($temporary, $json) !== strlen($json)
                || !chmod($temporary, 0660)
                || !rename($temporary, $path)) {
                throw new RuntimeException('Unable to save Speaking data.');
            }
        } finally {
            if (is_file($temporary)) {
                unlink($temporary);
            }
        }
    }

    public function config(): array
    {
        return $this->read('config.json');
    }

    public function saveConfig(array $changes): array
    {
        $valid = [];
        foreach (['lessonSearch', 'voice', 'lastLesson'] as $key) {
            if (is_string($changes[$key] ?? null) && strlen($changes[$key]) <= 4096) {
                $valid[$key] = $changes[$key];
            }
        }
        if (is_bool($changes['lenientMode'] ?? null)) {
            $valid['lenientMode'] = $changes['lenientMode'];
        }
        if (is_numeric($changes['rate'] ?? null) && $changes['rate'] >= 0.5 && $changes['rate'] <= 1.7) {
            $valid['rate'] = (string) $changes['rate'];
        }
        $old = $this->config();
        $config = array_replace($old, $valid);
        if ($config !== $old) {
            $this->write('config.json', $config);
        }
        return $config;
    }

    private function progressPath(string $file): string
    {
        return 'progress/' . substr($file, 0, -4) . '.json';
    }

    private function match(array $lines, array $saved): array
    {
        $byText = [];
        foreach ($saved as $item) {
            if (is_array($item) && is_string($item['text'] ?? null)) {
                $byText[$item['text']][] = $item;
            }
        }
        $occurrences = [];
        $result = [];
        foreach ($lines as $text) {
            $occurrence = $occurrences[$text] ?? 0;
            $occurrences[$text] = $occurrence + 1;
            $item = $byText[$text][$occurrence] ?? [];
            $count = $item['correctCount'] ?? 0;
            $result[] = [
                'text' => $text,
                'correctCount' => is_int($count) && $count >= 0 ? $count : 0,
                'starred' => ($item['starred'] ?? false) === true,
            ];
        }
        return $result;
    }

    public function progress(array $lesson): array
    {
        return $this->match($lesson['lines'], $this->read($this->progressPath($lesson['id'])));
    }

    public function update(array $lesson, array $request): array
    {
        $index = $request['index'] ?? null;
        if (($request['revision'] ?? null) !== $lesson['revision']
            || !is_int($index) || !isset($lesson['lines'][$index])) {
            throw new UnexpectedValueException('The lesson has changed. Reload it before saving progress.');
        }
        $items = $this->match($lesson['lines'], $this->read($this->progressPath($lesson['id'])));
        switch ($request['action']) {
            case 'attempt':
                if ($items[$index]['correctCount'] < PHP_INT_MAX) {
                    $items[$index]['correctCount']++;
                }
                break;
            case 'resetCount':
                $items[$index]['correctCount'] = 0;
                break;
            case 'setStar':
                if (!is_bool($request['starred'] ?? null)) {
                    throw new InvalidArgumentException('Invalid star value.');
                }
                $items[$index]['starred'] = $request['starred'];
                break;
        }
        $this->write($this->progressPath($lesson['id']), $items);
        $this->updateSummary($lesson, $items);
        return $items;
    }

    public function refreshCompletion(array $lesson): void
    {
        $this->updateSummary($lesson, $this->progress($lesson));
    }

    public function summary(): array
    {
        return $this->read('completed.json');
    }

    private function updateSummary(array $lesson, array $items): void
    {
        $summary = $this->summary();
        $old = $summary;
        $file = $lesson['id'];
        if ($items && !in_array(0, array_column($items, 'correctCount'), true)) {
            $summary[$file] = $lesson['revision'];
        } else {
            unset($summary[$file]);
        }
        if ($summary !== $old) {
            $this->write('completed.json', $summary);
        }
    }

    public function changeLessonFile(string $file, ?string $newFile, callable $change): ?string
    {
        $path = $this->directory . '/' . $this->progressPath($file);
        $destination = $newFile === null
            ? $path . '.deleted'
            : $this->directory . '/' . $this->progressPath($newFile);
        $summary = $this->summary();
        $moved = false;
        if ($path !== $destination && is_file($path)) {
            if (file_exists($destination) || !rename($path, $destination)) {
                throw new RuntimeException('Unable to move lesson progress.');
            }
            $moved = true;
        }
        try {
            $selected = $change();
        } catch (Throwable $error) {
            if ($moved && !rename($destination, $path)) {
                throw new RuntimeException('Unable to restore lesson progress.', 0, $error);
            }
            throw $error;
        }
        if ($newFile === null && $moved && !unlink($destination)) {
            throw new RuntimeException('Unable to remove deleted lesson progress.');
        }
        if ($path !== $destination && isset($summary[$file])) {
            if ($newFile !== null) {
                $summary[$newFile] = $summary[$file];
            }
            unset($summary[$file]);
            $this->write('completed.json', $summary);
        }
        return $selected;
    }
}
