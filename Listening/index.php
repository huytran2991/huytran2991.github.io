<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>English Listening Practice</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="css/styles.css">
  <script src="../practice-api.js" defer></script>
  <script src="js/practice.js" defer></script>
  <script src="../practice-state.js?v=<?= filemtime(__DIR__ . '/../practice-state.js') ?>" defer></script>
  <script src="js/app.js?v=<?= filemtime(__DIR__ . '/js/app.js') ?>" defer></script>
</head>
<body>
<div class="shell">
  <header class="header">
    <div><p class="eyebrow">ENGLISH PRACTICE</p><h1>Listen. Type. Improve.</h1><p class="muted">Your work, your words. One sentence at a time.</p></div>
    <a class="btn ghost" href="../Speaking/">Speaking practice ↗</a>
  </header>
  <div class="workspace">
    <aside class="card library" aria-label="Lesson library">
      <div class="section-heading"><h2>Your lessons</h2><button class="btn ghost compact" id="reload" type="button">Reload</button></div>
      <div class="lesson-search">
        <label for="lesson-search">Search lessons</label>
        <input id="lesson-search" type="search" placeholder="Search by lesson name…" aria-controls="lessons" autocomplete="off">
      </div>
      <p class="small">Each .txt file in Listening/lessons or its subfolders is a lesson. Each nonempty line is one sentence.</p>
      <p id="lesson-search-empty" class="small" role="status" hidden>No matching lessons.</p>
      <div id="lessons" class="lesson-list"></div>
      <form id="create-lesson" class="lesson-form">
        <h2>Create a lesson</h2>
        <label for="file-name">File name</label>
        <input id="file-name" type="text" placeholder="My lesson.txt" maxlength="180" required>
        <label for="file-content">Content</label>
        <textarea id="file-content" rows="5" placeholder="One sentence per line" required></textarea>
        <button class="btn" id="create" type="submit">Create</button>
        <p id="create-status" class="small" role="status" aria-live="polite"></p>
      </form>
      <div class="library-footer"><span id="completed">0 completed</span><progress id="progress" value="0" max="1" aria-label="Lesson completion"></progress></div>
    </aside>
    <main>
      <section class="card settings" aria-label="Speech settings">
        <label>English voice<select id="voice"><option value="">Browser default (English)</option></select></label>
        <label>Speed<select id="rate" aria-describedby="speed-shortcuts" aria-keyshortcuts="Control+ArrowUp Control+ArrowDown"><option value="0.6">0.6×</option><option value="0.75">0.75×</option><option value="0.9">0.9×</option><option value="1" selected>1×</option><option value="1.1">1.1×</option><option value="1.25">1.25×</option></select><span id="speed-shortcuts" class="small">Ctrl + ↑ faster · Ctrl + ↓ slower</span></label>
      </section>
      <p id="status" class="small" role="status" aria-live="polite"></p>
      <section class="card practice" aria-label="Dictation exercise">
        <div class="section-heading lesson-heading">
          <button class="btn ghost compact" id="edit" type="button" aria-label="Edit lesson" title="Edit lesson" aria-controls="lesson-editor" aria-expanded="false" disabled>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="m16 3 5 5M3 21l5-1L21 7a2.12 2.12 0 0 0-5-5L3 15z"/></svg>
          </button>
          <h2 id="lesson-title">Choose a lesson</h2>
          <span class="pill" id="position">0 / 0</span>
        </div>
        <form id="lesson-editor" class="lesson-form" hidden>
          <label for="edit-content">Lesson content</label>
          <textarea id="edit-content" rows="10" required></textarea>
          <div class="actions"><button class="btn" id="save-lesson" type="submit">Save</button><button class="btn ghost" id="cancel-edit" type="button">Cancel</button></div>
          <p id="edit-status" class="small" role="status" aria-live="polite"></p>
        </form>
        <div class="player"><button class="btn" id="play" type="button" disabled>▶ Play sentence</button><button class="btn ghost" id="stop" type="button" disabled>■ Stop</button><button class="btn secondary" id="add-speaking" type="button" disabled>Add to Speaking</button><p class="small" id="audio-status" role="status">Ready when you are.</p></div>
        <p id="transfer-status" class="small" role="status" aria-live="polite" hidden></p>
        <form id="answer-form">
          <label for="answer">Your answer</label>
          <textarea id="answer" rows="4" spellcheck="false" autocapitalize="off" autocomplete="off" autocorrect="off" placeholder="Type the sentence you hear…" disabled></textarea>
          <div class="actions"><button class="btn" id="check" type="submit" disabled>Check answer</button><button class="btn ghost" id="reveal" type="button" aria-controls="answer-preview" aria-expanded="false" title="Hold to show the answer" disabled>Hold to show answer</button><span class="small">Enter to check / next when correct · Ctrl/⌘ + Enter to replay</span></div>
        </form>
        <div id="feedback" class="feedback" role="status" aria-live="polite" hidden></div>
        <div id="answer-preview" class="feedback" hidden></div>
        <div class="navigation"><button class="btn ghost" id="previous" type="button" disabled>← Previous</button><span class="small">Capitalization and punctuation are ignored.</span><button class="btn secondary" id="next" type="button" disabled>Next →</button></div>
      </section>
      <section class="card sentence-card" aria-label="Sentence navigation"><div class="section-heading"><h2>Sentences</h2><button class="btn ghost compact" id="clear-all" type="button" title="Clear correct and viewed marks for this lesson" disabled>Clear all</button></div><div id="sentences" class="sentence-grid"></div><p class="small sentence-legend">✓ Correct · ◉ Answer viewed</p></section>
    </main>
  </div>
  <footer class="small">Audio uses your browser’s text-to-speech voices. Progress and voice settings are saved in this browser.</footer>
</div>
</body>
</html>
