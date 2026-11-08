<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>English Speaking Practice — Full</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="css/styles.css?v=<?= filemtime(__DIR__ . "/css/styles.css") ?>" />
</head>
<body>
  <div class="app">
      <button id="btnShowHideSidebar" aria-label="Toggle lesson list" aria-expanded="false">›</button>
    <div class="sidebar" id="sidebar">
      <h1>English Practice</h1>
      <div class="sidebar-action-group">
        <input aria-label="New lesson name" id="newListName" placeholder="Lesson name / topic" class="w-full mb-8" />
        <div class="flex-gap-8">
          <button id="btnCreateList" class="btn">Create</button>
          <button id="btnDeleteList" class="btn ghost" title="Delete the current lesson">Delete current</button>
        </div>
      </div>

      <div>
        <label class="small" for="lessonSearch">Search lesson files</label>
        <input id="lessonSearch" type="search" class="w-full" placeholder="Enter a lesson name…" aria-controls="lists" disabled />
        <p id="lessonSearchStatus" class="small" role="status" hidden>No matching lesson files found.</p>
      </div>
      <div class="lists" id="lists"></div>

      <p class="small">Each .txt file in the lessons folder is a lesson. Each line is one sentence.</p>
      <button id="btnReloadLists" class="btn secondary">Reload lessons</button>

      <footer>
        <div class="small">Use Chrome on desktop over HTTPS or localhost for speech recognition.</div>
      </footer>
    </div>

    <div class="main">
      <div class="topbar">
        <div class="topbar-group">
          <label class="small" for="selectList">Lesson</label>
          <select id="selectList"></select>
          <button id="btnLoadDemo" class="btn secondary">Load demo</button>
        </div>

        <div class="topbar-group">
          <label class="small" for="voiceSelect">Voice:</label>
          <select id="voiceSelect"></select>
          <label class="small" for="rate">Speed</label>
          <input id="rate" type="range" min="0.5" max="1.7" step="0.1" value="1" />
          <button id="btnTestVoice" class="btn">Test</button>
        </div>
      </div>

      <p id="status" class="small" role="status" aria-live="polite"></p>

      <div class="lenient-controls">
        <label><input id="lenientMode" aria-describedby="lenientHelp" type="checkbox" disabled /> Lenient mode</label>
        <p class="small" id="lenientHelp">Green: exact match. Yellow: accepted word/phrase or missing/extra final s. Both count as correct when lenient mode is on.</p>
        <details id="acceptedWordsEditor" hidden>
          <summary>Edit accepted words</summary>
          <p class="small" id="acceptedWordsHelp">One group per line; separate equivalent words or phrases with commas (for example, I'm, I am). Each word or phrase can appear only once. Changes are shared across browsers. Missing or extra final s is handled automatically.</p>
          <label for="acceptedWords">Accepted word groups</label>
          <textarea id="acceptedWords" rows="7" class="w-full input-textarea" aria-describedby="acceptedWordsHelp" placeholder="path, bath&#10;2, two, to, too&#10;I'm, I am" disabled></textarea>
          <div class="flex-gap-8 mt-8">
            <button id="saveAcceptedWords" class="btn" disabled>Save</button>
            <button id="cancelAcceptedWords" class="btn secondary">Cancel</button>
            <button id="reloadAcceptedWords" class="btn secondary">Reload list</button>
          </div>
          <p id="acceptedWordsStatus" class="small" role="status" aria-live="polite"></p>
        </details>
      </div>

      <details class="sentence-input-group">
        <summary>Add sentences to this lesson</summary>
        <textarea aria-label="Sentences, one per line" id="inputSentences" rows="4" class="w-full input-textarea" placeholder="Enter one English sentence per line"></textarea>
        <div class="flex-gap-8 mt-8">
          <button id="btnAddSentences" class="btn">Add sentences</button>
          <button id="btnClearSentences" class="btn secondary">Clear</button>
        </div>
      </details>

      <label class="starred-filter"><input id="starredOnly" type="checkbox" aria-controls="sentences" /> Starred only</label>
      <div id="sentenceSearchGroup" hidden>
        <label class="small" for="sentenceSearch">Search sentences</label>
        <input id="sentenceSearch" type="search" class="w-full" placeholder="Enter words or a phrase…" aria-controls="sentences" />
      </div>
      <p id="sentenceFilterResults" class="small" role="status" aria-live="polite"></p>
      <p id="noMatchingSentences" class="small" hidden>No matching sentences found.</p>
      <div id="sentences"></div>
    </div>
  </div>

  <script src="../practice-api.js"></script>
  <script src="js/storage.js?v=<?= filemtime(__DIR__ . "/js/storage.js") ?>"></script>
  <script src="js/speech.js?v=<?= filemtime(__DIR__ . "/js/speech.js") ?>"></script>
  <script src="js/app.js?v=<?= filemtime(__DIR__ . "/js/app.js") ?>"></script>
</body>
</html>
