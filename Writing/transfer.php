<?php

require_once __DIR__ . '/../PracticeApi.php';

englishPracticeApi(true, static function (): void {
    require_once __DIR__ . '/WritingTransfers.php';
    writingHeaders();
    if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
        header('Allow: POST');
        writingReply(['error' => 'Use POST to add an accepted translation.'], 405);
        return;
    }
    try {
        writingSession();
        $csrf = $_SERVER['HTTP_X_CSRF_TOKEN'] ?? null;
        if (!is_string($csrf) || !hash_equals($_SESSION['csrf'], $csrf)) {
            session_write_close();
            writingReply(['error' => 'Your session expired. Reload lessons and try again.'], 403);
            return;
        }
        $raw = file_get_contents('php://input', false, null, 0, 2049);
        if ($raw === false || strlen($raw) > 2048) {
            throw new InvalidArgumentException('The request is too large.');
        }
        $request = json_decode($raw, true, 8, JSON_THROW_ON_ERROR);
        if (!is_array($request) || array_diff(array_keys($request), ['target', 'transferToken'])) {
            throw new InvalidArgumentException('Provide a destination and an accepted review token only.');
        }
        $directory = writingTransferDirectory($request['target'] ?? null);
        $answer = writingAcceptedTransfer($request, writingLessons(englishDataPath('Writing/lessons')));
        session_write_close();
        $now = new DateTimeImmutable();
        $added = writingAppendTransfer($directory, $answer, $now);
        writingReply(['added' => $added, 'target' => $request['target'], 'file' => writingTransferFilename($now)]);
    } catch (JsonException | InvalidArgumentException $error) {
        if (session_status() === PHP_SESSION_ACTIVE) { session_write_close(); }
        writingReply(['error' => 'Invalid transfer. Review your translation successfully and choose Speaking or Listening.'], 400);
    } catch (UnexpectedValueException $error) {
        if (session_status() === PHP_SESSION_ACTIVE) { session_write_close(); }
        writingReply(['error' => $error->getMessage()], 409);
    } catch (Throwable $error) {
        if (session_status() === PHP_SESSION_ACTIVE) { session_write_close(); }
        writingReply(['error' => 'Unable to save the translation. Check the destination lesson file permissions and try again.'], 500);
    }
});
