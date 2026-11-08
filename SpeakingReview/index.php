<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>English Speaking Review</title>
  <link rel="stylesheet" href="styles.css">
  <script src="../practice-api.js" defer></script>
  <script src="app.js" defer></script>
</head>
<body>
<div class="shell">
  <header><div><p class="eyebrow">ENGLISH PRACTICE / SPEAKING REVIEW</p><h1>Say it. Review it. Try again.</h1><p class="muted">Practice getting your message across. Keep your words, improve what matters.</p></div><nav aria-label="Other English tools"><a href="../Speaking/">Speaking</a><a href="../Writing/">Writing</a><a href="../Listening/">Listening</a></nav></header>
  <main>
    <aside class="card settings">
      <div class="heading"><h2>Review settings</h2><button id="reload" class="quiet" type="button">Reload prompts</button></div>
      <label for="prompt">Prompt file</label><select id="prompt" disabled><option>Loading…</option></select>
      <label for="model">Review model</label><select id="model" disabled><option>Loading…</option></select>
      <details><summary>Read selected prompt</summary><pre id="prompt-preview" lang="vi"></pre></details>
      <p id="config-status" class="small" role="status">Loading review settings…</p>
      <p class="small">Add or edit .txt files in SpeakingReview/prompts/, then reload prompts.</p>
    </aside>
    <div class="practice">
      <section class="card recorder" aria-labelledby="record-title">
        <p class="eyebrow">YOUR NEXT ATTEMPT</p><h2 id="record-title">Speak about something from work.</h2>
        <p class="muted">A short update, a question, or an explanation. Pause and repeat words whenever you need.</p>
        <div id="record-state" class="record-state"><span id="dot" class="dot"></span><span id="record-label">Ready to record</span><strong id="timer">0:00</strong></div>
        <div class="actions"><button id="record" type="button">Start recording</button><button id="stop" class="danger" type="button" disabled>Stop recording</button><label class="file-button" for="audio-file">Choose audio file<input id="audio-file" type="file" accept="audio/*,.mp3,.wav,.webm,.ogg,.flac,.m4a,.aac"></label></div>
        <p class="small">Record up to 3 minutes, or choose an audio file up to 8 MB. Server upload limits also apply.</p>
        <div id="preview" hidden><div class="heading"><span id="audio-name" class="small"></span><a id="download" download="speaking-practice.webm">Download audio</a></div><audio id="audio" controls preload="metadata"></audio></div>
        <div class="send-row"><button id="send" type="button" disabled>Send for review</button><button id="cancel" class="quiet" type="button" hidden>Cancel review</button></div>
        <p id="status" class="message" role="status" aria-live="polite">Record a short message or choose an audio file.</p>
      </section>
      <section aria-labelledby="reviews-title"><div class="heading history-heading"><div><p class="eyebrow">LISTEN, ADJUST, REPEAT</p><h2 id="reviews-title">Your reviews <span id="count" class="count">0</span></h2></div><button id="clear" class="quiet" type="button" disabled>Clear reviews</button></div><p id="empty" class="muted">Your feedback will appear here. Then record another attempt above.</p><div id="reviews"></div></section>
    </div>
  </main>
  <footer>Audio is sent to Google Gemini only when you click Send for review. Audio and the latest 6 reviews stay in this open page; reloading clears them. AI feedback and intelligibility estimates can be imperfect.</footer>
</div>
</body>
</html>
