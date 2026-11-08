<?php

declare(strict_types=1);

final class FirestorePracticeStore
{
    public const DIRECTORIES = [
        'Listening/lessons', 'Speaking/lessons', 'Speaking/settings', 'Writing/lessons',
        'SpeakingReview/prompts', 'data/listening/progress', 'data/speaking/progress', 'data/writing/progress',
    ];
    private const OWNER_HASH = '13347e1d788bb00d604c3ad839c7018b070f283d352ca42a79d7f4cf70766a67';
    private const DOCUMENTS = 'projects/english-practice-e5ebd/databases/(default)/documents';
    private const API = 'https://firestore.googleapis.com/v1/';
    private const CHUNK_SIZE = 700000;
    private const MAX_CHUNKS = 10;
    private string $path;

    public function __construct(private string $token)
    {
        if (!preg_match('/\A[A-Za-z0-9_-]+\.([A-Za-z0-9_-]+)\.[A-Za-z0-9_-]+\z/', $token, $parts)) {
            throw new RuntimeException('Sign in with Google to access English Practice.', 403);
        }

        // Use the claim only to select the owner path. Firestore verifies the token and Security Rules.
        $payload = base64_decode(strtr($parts[1], '-_', '+/'), true);
        $claims = $payload === false ? null : json_decode($payload, true);
        $uid = $claims['sub'] ?? null;
        if (!is_string($uid) || !preg_match('/\A[A-Za-z0-9_-]{1,128}\z/', $uid) ||
            !hash_equals(self::OWNER_HASH, hash('sha256', $uid))) {
            throw new RuntimeException('Sign in with your English Practice Google account.', 403);
        }
        $this->path = self::DOCUMENTS . '/users/' . $uid . '/englishPractice/v1';
    }

    public function read(): ?array
    {
        for ($attempt = 0; $attempt < 2; ++$attempt) {
            $root = $this->request($this->path);
            if ($root === null) {
                return null;
            }
            $fields = $root['fields'] ?? [];
            $count = (int) ($fields['chunkCount']['integerValue'] ?? 0);
            $revision = $fields['revision']['stringValue'] ?? null;
            $payload = $fields['payload']['stringValue'] ?? null;
            if ((string) ($fields['schemaVersion']['integerValue'] ?? '') !== '1' ||
                !is_string($revision) || !is_string($payload) || !is_string($root['updateTime'] ?? null) ||
                $count < 1 || $count > self::MAX_CHUNKS) {
                throw new RuntimeException('Firestore contains an invalid English Practice snapshot.');
            }
            for ($index = 1; $index < $count; ++$index) {
                $part = $this->request($this->chunkPath($index));
                if (($part['fields']['revision']['stringValue'] ?? null) !== $revision ||
                    !is_string($part['fields']['payload']['stringValue'] ?? null)) {
                    continue 2;
                }
                $payload .= $part['fields']['payload']['stringValue'];
            }
            $files = json_decode($payload, true, 16, JSON_THROW_ON_ERROR);
            if (!is_array($files)) {
                throw new RuntimeException('Firestore contains invalid practice data.');
            }
            foreach ($files as $path => $text) {
                if (!is_string($path) || !is_string($text) || !self::isDataFile($path)) {
                    throw new RuntimeException('Firestore contains an invalid practice file.');
                }
            }
            ksort($files);
            return ['files' => $files, 'updateTime' => $root['updateTime'], 'chunkCount' => $count];
        }
        throw new RuntimeException('Practice data changed while loading. Reload and try again.', 409);
    }

    public function write(array $files, array $previous): void
    {
        ksort($files);
        $remaining = json_encode($files, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR);
        $chunks = [];
        while ($remaining !== '') {
            $chunk = mb_strcut($remaining, 0, self::CHUNK_SIZE, 'UTF-8');
            $chunks[] = $chunk;
            $remaining = substr($remaining, strlen($chunk));
        }
        if (count($chunks) > self::MAX_CHUNKS) {
            throw new RuntimeException('Practice data exceeds the supported snapshot size.');
        }

        $writes = [];
        $revision = bin2hex(random_bytes(16));
        foreach ($chunks as $index => $chunk) {
            $fields = ['revision' => ['stringValue' => $revision], 'payload' => ['stringValue' => $chunk]];
            $write = [];
            if ($index === 0) {
                $fields['schemaVersion'] = ['integerValue' => '1'];
                $fields['chunkCount'] = ['integerValue' => (string) count($chunks)];
                $write['currentDocument'] = ['updateTime' => $previous['updateTime']];
            }
            $write['update'] = ['name' => $this->chunkPath($index), 'fields' => $fields];
            $writes[] = $write;
        }
        for ($index = count($chunks); $index < $previous['chunkCount']; ++$index) {
            $writes[] = ['delete' => $this->chunkPath($index)];
        }
        $this->request(self::DOCUMENTS . ':commit', ['writes' => $writes]);
    }

    private function chunkPath(int $index): string
    {
        return $this->path . ($index === 0 ? '' : '-chunk-' . $index);
    }

    private function request(string $path, ?array $data = null): ?array
    {
        $curl = curl_init(self::API . $path);
        $headers = ['Authorization: Bearer ' . $this->token, 'Accept: application/json'];
        if ($data !== null) {
            $body = json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR);
            if (strlen($body) > 9 * 1024 * 1024) {
                throw new RuntimeException('Practice data exceeds the supported Firestore request size.');
            }
            $headers[] = 'Content-Type: application/json';
            curl_setopt($curl, CURLOPT_POSTFIELDS, $body);
        }
        curl_setopt_array($curl, [
            CURLOPT_HTTPHEADER => $headers,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_CONNECTTIMEOUT => 5,
            CURLOPT_TIMEOUT => 15,
        ]);
        $response = curl_exec($curl);
        $status = curl_getinfo($curl, CURLINFO_RESPONSE_CODE);
        if ($response === false) {
            throw new RuntimeException('Could not connect to Firestore.');
        }
        if ($status === 404 && $data === null) {
            return null;
        }
        $result = json_decode($response, true, 32, JSON_THROW_ON_ERROR);
        if ($status === 401 || $status === 403) {
            throw new RuntimeException('Firestore denied access. Sign in with your English Practice Google account.', 403);
        }
        if (in_array($result['error']['status'] ?? null, ['FAILED_PRECONDITION', 'ALREADY_EXISTS', 'ABORTED'], true)) {
            throw new RuntimeException('Practice data changed elsewhere. Reload and try again.', 409);
        }
        if ($status !== 200 || !is_array($result)) {
            throw new RuntimeException('Firestore request failed (HTTP ' . $status . ').');
        }
        return $result;
    }

    public static function isDataFile(string $path): bool
    {
        if (preg_match('~(?:^|/)\.|[\\\\\x00-\x1f\x7f]|//~', $path)) {
            return false;
        }
        return preg_match('~\A(?:Listening/lessons|Speaking/(?:lessons|settings)|Writing/lessons|SpeakingReview/prompts)/.+\.txt\z~i', $path)
            || preg_match('~\Adata/(?:listening|speaking|writing)/(?:progress/[^/]+|config|completed)\.json\z~', $path);
    }

    public static function collect(string $directory): array
    {
        $files = [];
        foreach (new RecursiveIteratorIterator(new RecursiveDirectoryIterator($directory, FilesystemIterator::SKIP_DOTS)) as $entry) {
            $path = substr($entry->getPathname(), strlen($directory) + 1);
            if ($entry->isLink() || !$entry->isFile() || !self::isDataFile($path)) {
                continue;
            }
            $contents = file_get_contents($entry->getPathname());
            if ($contents === false) {
                throw new RuntimeException('A practice data file could not be read.');
            }
            $files[$path] = $contents;
        }
        ksort($files);
        return $files;
    }
}
