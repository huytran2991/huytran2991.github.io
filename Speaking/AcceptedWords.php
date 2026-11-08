<?php

/** Shared word groups, independent of lessons and browser practice results. */
final class AcceptedWords
{
    private string $file;

    public function __construct(string $file)
    {
        $this->file = $file;
    }

    public static function groups(string $text): array
    {
        if (strlen($text) > 100000 || !preg_match('//u', $text)) {
            throw new InvalidArgumentException('Use UTF-8 text up to 100 KB.');
        }
        $text = preg_replace('/\A\xEF\xBB\xBF/', '', $text);
        $groups = [];
        $seen = [];
        foreach (preg_split('/\r\n|\n|\r/', $text) as $index => $line) {
            if (trim($line) === '') {
                continue;
            }
            $words = array_map(
                static fn($word) => strtolower(preg_replace('/[ \t]+/', ' ', trim(str_replace(['’', '‘'], "'", $word)))),
                explode(',', $line)
            );
            if (count($words) < 2) {
                throw new InvalidArgumentException('Line ' . ($index + 1) . ': enter at least two comma-separated words or phrases.');
            }
            foreach ($words as $word) {
                if (!preg_match("/\\A[a-z0-9]+(?:['-][a-z0-9]+)*(?: [a-z0-9]+(?:['-][a-z0-9]+)*)*\\z/", $word)) {
                    throw new InvalidArgumentException('Line ' . ($index + 1) . ': use English words or phrases with internal apostrophes or hyphens, separated by commas.');
                }
                $identity = str_replace("'", '', $word);
                if (isset($seen[$identity])) {
                    throw new InvalidArgumentException('Line ' . ($index + 1) . ': each word or phrase must appear only once in the list.');
                }
                $seen[$identity] = true;
            }
            $groups[] = $words;
        }
        return $groups;
    }

    public function read(): array
    {
        return $this->access(null, null);
    }

    public function save(string $text, string $revision): array
    {
        self::groups($text);
        return $this->access($text, $revision);
    }

    private function access(?string $replacement, ?string $revision): array
    {
        if (is_link($this->file) || is_link($this->file . '.lock')) {
            throw new RuntimeException('Symbolic links are not supported.');
        }
        $lock = fopen($this->file . '.lock', 'c');
        if ($lock === false) {
            throw new RuntimeException('Unable to open the word list lock.');
        }
        $temporary = null;
        try {
            if (!flock($lock, $replacement === null ? LOCK_SH : LOCK_EX)) {
                throw new RuntimeException('Unable to lock the word list.');
            }
            $text = file_get_contents($this->file);
            if ($text === false) {
                throw new RuntimeException('Unable to read the word list.');
            }
            if ($replacement !== null) {
                if (!hash_equals(hash('sha256', $text), $revision)) {
                    throw new UnexpectedValueException('The word list changed. Reload it before saving again. Copy your edits first.');
                }
                $temporary = tempnam(dirname($this->file), '.words-');
                if ($temporary === false || file_put_contents($temporary, $replacement) !== strlen($replacement)
                    || !chmod($temporary, 0660) || !rename($temporary, $this->file)) {
                    throw new RuntimeException('Unable to save the word list.');
                }
                $text = $replacement;
            }
            return ['text' => $text, 'groups' => self::groups($text), 'revision' => hash('sha256', $text)];
        } finally {
            if (is_string($temporary) && is_file($temporary)) {
                unlink($temporary);
            }
            flock($lock, LOCK_UN);
            fclose($lock);
        }
    }
}
