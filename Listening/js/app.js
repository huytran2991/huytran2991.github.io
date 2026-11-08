(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  let saved = {}, lessons = [], current = null, index = 0, drafts = new Map(), voices = [], utterance = null, speechEpoch = 0;
  let answerCheckedCorrect = false, lessonsLoaded = false, editing = null;
  let transfer = null;
  const results = new Map();
  const files = new PracticeFiles(error => { $('status').textContent = error.message; });
  let progressEpoch = 0;
  function persist(changes = {}) {
    if (current) {
      changes.lesson = current.id;
      changes.selection = current.lines.length ? sentenceKey() : null;
    }
    Object.assign(saved, changes);
    files.config(changes);
  }
  function sentenceKey(at = index) {
    const text = current.lines[at];
    const occurrence = current.lines.slice(0, at).filter(line => line === text).length;
    return JSON.stringify([current.id, text, occurrence]);
  }
  function applyResults(lesson, values) {
    results.clear();
    for (const [key, value] of Object.entries(values)) {
      const [text, occurrence] = JSON.parse(key);
      results.set(JSON.stringify([lesson.id, text, occurrence]), value);
    }
    renderProgress();
  }
  async function saveMark(value) {
    const lesson = current;
    const epoch = progressEpoch;
    const key = JSON.stringify(JSON.parse(sentenceKey()).slice(1));
    try {
      const values = await files.lesson('mark', lesson, {sentence: key, result: value});
      if (epoch === progressEpoch) applyResults(lesson, values);
    } catch (error) {
      $('status').textContent = error.message;
    }
  }
  function stop() {
    speechEpoch++;
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    utterance = null;
    $('play').textContent = '▶ Play sentence';
    $('stop').disabled = true;
    $('audio-status').textContent = 'Ready when you are.';
  }
  function play() {
    if (!current?.lines.length || !('speechSynthesis' in window)) return;
    stop();
    const epoch = speechEpoch;
    utterance = new SpeechSynthesisUtterance(current.lines[index]);
    const selected = voices.find(voice => voice.voiceURI === $('voice').value);
    if (selected) utterance.voice = selected;
    utterance.lang = selected?.lang || 'en-US';
    utterance.rate = Number($('rate').value);
    utterance.onstart = () => {
      if (epoch !== speechEpoch) return;
      $('audio-status').textContent = 'Playing…';
      $('stop').disabled = false;
      $('play').textContent = '↻ Replay sentence';
    };
    utterance.onend = () => { if (epoch === speechEpoch) stop(); };
    utterance.onerror = event => {
      if (epoch !== speechEpoch) return;
      stop();
      if (!['canceled', 'interrupted'].includes(event.error)) $('audio-status').textContent = 'Audio could not play. Try another English voice and press Play again.';
    };
    $('audio-status').textContent = 'Starting audio…';
    $('stop').disabled = false;
    try { window.speechSynthesis.speak(utterance); }
    catch (_) { stop(); $('audio-status').textContent = 'Audio could not start. Try another voice.'; }
    $('answer').focus();
  }
  function updateVoices() {
    if (!('speechSynthesis' in window)) {
      $('status').textContent = 'This browser does not support text-to-speech. Open this page in a browser with speech synthesis.';
      return;
    }
    voices = window.speechSynthesis.getVoices().filter(voice => /^en(?:-|_)/i.test(voice.lang));
    $('voice').replaceChildren(new Option('Browser default (English)', ''));
    voices.forEach(voice => $('voice').add(new Option(`${voice.name} (${voice.lang})`, voice.voiceURI)));
    $('voice').value = voices.some(voice => voice.voiceURI === saved.voice) ? saved.voice : '';
  }
  function renderLibrary() {
    $('lessons').replaceChildren();
    if (!lessons.length) $('lessons').textContent = 'No lessons yet. Create one below.';
    lessons.forEach(lesson => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'lesson' + (lesson === current ? ' active' : '');
      button.setAttribute('aria-pressed', String(lesson === current));
      const title = document.createElement('strong');
      title.textContent = lesson.name;
      const count = document.createElement('span');
      count.className = 'small';
      count.textContent = `${lesson.lines.length} sentences`;
      const check = document.createElement('span');
      check.className = 'lesson-check';
      check.textContent = '✓';
      check.setAttribute('aria-hidden', 'true');
      check.hidden = true;
      button.append(title, count, check);
      button.addEventListener('click', () => selectLesson(lesson));
      $('lessons').append(button);
    });
    updateLibraryCompletion();
    filterLibrary();
  }
  function filterLibrary() {
    const query = $('lesson-search').value.trim().toLowerCase();
    let matches = 0;
    lessons.forEach((lesson, at) => {
      const visible = lesson.name.toLowerCase().includes(query);
      $('lessons').children[at].hidden = !visible;
      if (visible) matches++;
    });
    $('lesson-search-empty').hidden = !lessons.length || matches > 0;
  }
  function updateLibraryCompletion() {
    lessons.forEach((lesson, at) => {
      const complete = lesson.lines.length > 0 && files.done(lesson) === lesson.lines.length;
      const button = $('lessons').children[at];
      button.classList.toggle('completed', complete);
      button.querySelector('.lesson-check').hidden = !complete;
      button.setAttribute('aria-label', `${lesson.name}, ${lesson.lines.length} sentences${complete ? ', completed' : ''}`);
    });
  }
  function renderProgress() {
    $('clear-all').disabled = !current?.lines.length;
    $('sentences').replaceChildren();
    let completed = 0;
    (current?.lines || []).forEach((line, at) => {
      const result = results.get(sentenceKey(at));
      if (result === 'correct') completed++;
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'sentence ' + (result || '') + (at === index ? ' selected' : '');
      button.textContent = `${at + 1}${result === 'correct' ? ' ✓' : result === 'viewed' ? ' ◉' : ''}`;
      button.setAttribute('aria-label', `Sentence ${at + 1}${result === 'correct' ? ', correct' : result === 'viewed' ? ', answer viewed' : ''}`);
      if (at === index) button.setAttribute('aria-current', 'step');
      button.addEventListener('click', () => go(at));
      $('sentences').append(button);
    });
    const total = current?.lines.length || 0;
    $('completed').textContent = `${completed} / ${total} completed${total && completed === total ? ' · Lesson complete!' : ''}`;
    $('progress').max = total || 1;
    $('progress').value = completed;
    updateLibraryCompletion();
  }
  function renderSentence() {
    if (transfer?.controller) transfer.controller.abort();
    transfer = null;
    $('transfer-status').hidden = true;
    $('transfer-status').replaceChildren();
    answerCheckedCorrect = false;
    hideAnswer();
    stop();
    const available = Boolean(current?.lines.length);
    $('edit').disabled = !current;
    $('lesson-title').textContent = current?.name || 'Choose a lesson';
    $('position').textContent = `${available ? index + 1 : 0} / ${current?.lines.length || 0}`;
    $('answer').value = available ? drafts.get(sentenceKey()) || '' : '';
    $('feedback').hidden = true;
    $('feedback').replaceChildren();
    ['answer', 'check', 'reveal'].forEach(id => $(id).disabled = !available);
    $('add-speaking').disabled = !available || !lessonsLoaded;
    $('add-speaking').textContent = 'Add to Speaking';
    $('play').disabled = !available || !('speechSynthesis' in window);
    $('previous').disabled = !available || index === 0;
    $('next').disabled = !available || index === current.lines.length - 1;
    if (current && !available) $('status').textContent = 'This lesson is empty. Add one sentence per line and reload.';
    renderProgress();
  }
  async function selectLesson(lesson, selection = null) {
    if (current?.lines.length) drafts.set(sentenceKey(), $('answer').value);
    closeEditor();
    const epoch = ++progressEpoch;
    current = lesson;
    index = Math.max(0, lesson.lines.findIndex((_, at) => sentenceKey(at) === selection));
    results.clear();
    $('status').textContent = '';
    persist();
    renderLibrary();
    renderSentence();
    try {
      const values = await files.lesson('lesson', lesson);
      if (epoch === progressEpoch) applyResults(lesson, values);
    } catch (error) {
      if (epoch === progressEpoch) $('status').textContent = error.message;
    }
  }
  function go(at) {
    if (!current || at < 0 || at >= current.lines.length) return;
    drafts.set(sentenceKey(), $('answer').value);
    index = at;
    persist();
    renderSentence();
    $('answer').focus();
  }
  function nextSentence() {
    if (!current || index >= current.lines.length - 1) return;
    go(index + 1);
    $('rate').value = '1';
    persist({rate: '1'});
    play();
  }
  async function reload() {
    if (transfer?.controller) transfer.controller.abort();
    transfer = null;
    $('add-speaking').disabled = true;
    $('transfer-status').hidden = true;
    $('reload').disabled = true;
    $('status').textContent = 'Loading lessons…';
    try {
      const response = await englishPracticeFetch('lessons', {cache: 'no-store'});
      const data = await response.json();
      if (!response.ok || !Array.isArray(data.lessons)) throw new Error(data.error || 'Unable to load lessons.');
      lessonsLoaded = true;
      saved = await files.open();
      if (Array.from($('rate').options).some(option => option.value === saved.rate)) $('rate').value = saved.rate;
      updateVoices();
      $('lesson-search').value = saved.lessonSearch || '';
      lessons = data.lessons;
      const selected = lessons.find(lesson => lesson.id === (current?.id || saved.lesson)) || lessons[0];
      if (selected) {
        const selection = current?.lines.length ? sentenceKey() : saved.selection;
        await selectLesson(selected, selection);
      }
      else { ++progressEpoch; current = null; results.clear(); renderLibrary(); renderSentence(); $('status').textContent = ''; }
    } catch (error) { lessonsLoaded = false; $('status').textContent = `Could not reload lessons: ${error.message}`; }
    finally { $('reload').disabled = false; }
  }
  async function addToSpeaking() {
    if ($('add-speaking').disabled || !current?.lines.length || !lessonsLoaded) return;
    const operation = {controller: new AbortController()};
    transfer = operation;
    $('add-speaking').disabled = true;
    $('transfer-status').hidden = false;
    $('transfer-status').textContent = 'Adding this sentence to Speaking…';
    const timer = setTimeout(() => operation.controller.abort(), 20000);
    try {
      const response = await englishPracticeFetch('transfer', {method: 'POST', credentials: 'same-origin',
        signal: operation.controller.signal, headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({lesson: current.id, revision: current.revision, index})});
      const data = await response.json();
      if (transfer !== operation) return;
      if (!response.ok) throw new Error(typeof data.error === 'string' ? data.error : 'Unable to add this sentence.');
      if (data.file !== 'From Listening.txt' || typeof data.added !== 'boolean') throw new Error('Unable to confirm the saved sentence. Try again.');
      $('add-speaking').textContent = 'Added to Speaking';
      $('transfer-status').textContent = `${data.added ? 'Added to' : 'Already in'} Speaking / From Listening. `;
      const link = document.createElement('a');
      link.href = '../Speaking/'; link.target = '_blank'; link.rel = 'noopener'; link.textContent = 'Open Speaking';
      $('transfer-status').append(link);
    } catch (error) {
      if (transfer === operation) {
        $('add-speaking').disabled = false;
        $('transfer-status').textContent = error.name === 'AbortError'
          ? 'Saving timed out. Try again; duplicate sentences will not be added.' : error.message;
      }
    } finally { clearTimeout(timer); }
  }
  function closeEditor() {
    editing = null;
    $('lesson-editor').hidden = true;
    $('edit').setAttribute('aria-expanded', 'false');
    $('edit-content').value = '';
    $('edit-status').textContent = '';
  }
  async function saveLesson(payload) {
    const response = await englishPracticeFetch('lessons', {
      method: 'POST', cache: 'no-store',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify(payload),
    });
    const data = await response.json();
    if (!response.ok || !Array.isArray(data.lessons)) throw new Error(data.error || 'Unable to save lesson.');
    lessonsLoaded = true;
    return data;
  }
  function acceptLessons(data, selectedId) {
    lessons = data.lessons;
    const selected = lessons.find(lesson => lesson.id === selectedId) || lessons[0];
    if (selected) selectLesson(selected);
    else { current = null; closeEditor(); renderLibrary(); renderSentence(); }
  }
  $('create-lesson').addEventListener('submit', async event => {
    event.preventDefault();
    if ($('create').disabled) return;
    let file = $('file-name').value.trim();
    if (!/\.txt$/i.test(file)) file += '.txt';
    $('create').disabled = true;
    $('create-status').textContent = 'Creating lesson…';
    try {
      const data = await saveLesson({action: 'create', file, content: $('file-content').value});
      acceptLessons(data, data.selected);
      $('file-name').value = '';
      $('file-content').value = '';
      $('create-status').textContent = 'Lesson created.';
    } catch (error) { $('create-status').textContent = error.message; }
    finally { $('create').disabled = false; }
  });
  $('edit').addEventListener('click', () => {
    if (!current) return;
    stop();
    hideAnswer();
    editing = {file: current.id, revision: current.revision};
    $('edit-content').value = current.content ?? current.lines.join('\n');
    $('edit-status').textContent = '';
    $('lesson-editor').hidden = false;
    $('edit').setAttribute('aria-expanded', 'true');
    $('edit-content').focus();
  });
  $('cancel-edit').addEventListener('click', () => { closeEditor(); $('edit').focus(); });
  $('lesson-editor').addEventListener('submit', async event => {
    event.preventDefault();
    if (!editing || $('save-lesson').disabled) return;
    const target = editing;
    $('save-lesson').disabled = true;
    $('edit-status').textContent = 'Saving lesson…';
    try {
      const data = await saveLesson({action: 'update', ...target, content: $('edit-content').value});
      // Do not interrupt a different lesson selected while the request was pending.
      acceptLessons(data, current?.id || data.selected);
      $('status').textContent = 'Lesson saved.';
    } catch (error) { if (editing === target) $('edit-status').textContent = error.message; }
    finally { $('save-lesson').disabled = false; }
  });
  $('answer-form').addEventListener('submit', event => {
    event.preventDefault();
    if (!current?.lines.length) return;
    answerCheckedCorrect = false;
    const feedback = $('feedback');
    feedback.hidden = false;
    feedback.className = 'feedback';
    feedback.replaceChildren();
    if (!Dictation.words($('answer').value).length) { feedback.textContent = 'Type your answer first, then check it.'; return; }
    if (Dictation.words(current.lines[index]).length > 500 || Dictation.words($('answer').value).length > 500) {
      feedback.textContent = 'This sentence is too long to compare. Use at most 500 words per line.'; return;
    }
    const comparison = Dictation.compare(current.lines[index], $('answer').value);
    if (comparison.correct) {
      answerCheckedCorrect = true;
      feedback.classList.add('success');
      feedback.textContent = index < current.lines.length - 1 ? '✓ Correct! Press Enter again for the next sentence.' : '✓ Correct! This is the last sentence.';
      saveMark('correct');
    } else {
      const heading = document.createElement('p');
      heading.textContent = 'Keep listening. Fix the highlighted words and try again.';
      feedback.append(heading);
      comparison.tokens.forEach(token => {
        const span = document.createElement('span');
        span.className = `word ${token.kind}`;
        // Hide missing/corrected words until the learner explicitly reveals the answer.
        span.textContent = token.kind === 'missing' ? '[missing word]' : token.actual;
        span.title = token.kind === 'correct' ? 'Correct' : token.kind === 'missing' ? 'A word is missing here' : token.kind === 'extra' ? 'Extra word' : 'Incorrect word';
        feedback.append(span, document.createTextNode(' '));
      });
      const legend = document.createElement('p');
      legend.className = 'small';
      legend.textContent = 'Green: correct · Red: incorrect · Dashed: missing · Struck through: extra';
      feedback.append(legend);
    }
  });
  function showAnswer() {
    if (!current?.lines.length) return;
    $('answer-preview').hidden = false;
    $('answer-preview').textContent = `Answer: ${current.lines[index]}`;
    $('reveal').setAttribute('aria-expanded', 'true');
    if (!results.has(sentenceKey())) saveMark('viewed');
  }
  function hideAnswer() {
    $('answer-preview').hidden = true;
    $('answer-preview').textContent = '';
    $('reveal').setAttribute('aria-expanded', 'false');
  }
  $('reveal').addEventListener('pointerdown', event => {
    if (event.button !== 0) return;
    showAnswer();
  });
  ['pointerup', 'pointercancel'].forEach(type => document.addEventListener(type, hideAnswer));
  ['pointerleave', 'blur', 'contextmenu'].forEach(type => $('reveal').addEventListener(type, hideAnswer));
  $('reveal').addEventListener('keydown', event => {
    if (![' ', 'Enter'].includes(event.key)) return;
    event.preventDefault();
    if (!event.repeat) showAnswer();
  });
  $('reveal').addEventListener('keyup', event => {
    if (![' ', 'Enter'].includes(event.key)) return;
    event.preventDefault();
    hideAnswer();
  });
  window.addEventListener('blur', hideAnswer);
  document.addEventListener('visibilitychange', () => { if (document.hidden) hideAnswer(); });
  $('answer').addEventListener('input', () => { answerCheckedCorrect = false; $('feedback').hidden = true; });
  $('answer').addEventListener('keydown', event => {
    if (event.isComposing || event.key !== 'Enter') return;
    if (event.ctrlKey || event.metaKey) { event.preventDefault(); if (!event.repeat) play(); }
    else if (!event.shiftKey) {
      event.preventDefault();
      if (event.repeat) return;
      if (answerCheckedCorrect) nextSentence();
      else $('answer-form').requestSubmit();
    }
  });
  $('clear-all').addEventListener('click', () => {
    if (!current?.lines.length) return;
    answerCheckedCorrect = false;
    $('answer').value = '';
    drafts.delete(sentenceKey());
    hideAnswer();
    $('feedback').hidden = true;
    $('feedback').replaceChildren();
    const lesson = current;
    const epoch = progressEpoch;
    files.lesson('clear', lesson).then(values => {
      if (epoch !== progressEpoch) return;
      applyResults(lesson, values);
      $('status').textContent = 'Correct and viewed marks cleared for this lesson.';
    }).catch(error => { $('status').textContent = error.message; });
  });
  $('previous').addEventListener('click', () => go(index - 1));
  $('next').addEventListener('click', nextSentence);
  $('play').addEventListener('click', play);
  $('add-speaking').addEventListener('click', addToSpeaking);
  $('stop').addEventListener('click', stop);
  $('reload').addEventListener('click', reload);
  $('lesson-search').addEventListener('input', () => {
    filterLibrary();
    files.config({lessonSearch: $('lesson-search').value});
  });
  $('voice').addEventListener('change', () => { stop(); persist({voice: $('voice').value}); });
  $('rate').addEventListener('change', () => { stop(); persist({rate: $('rate').value}); });
  document.addEventListener('keydown', event => {
    if (event.defaultPrevented || event.isComposing || !event.ctrlKey || event.altKey || event.metaKey || event.shiftKey) return;
    if (!['ArrowUp', 'ArrowDown'].includes(event.key)) return;
    event.preventDefault();
    const rate = $('rate');
    const next = rate.selectedIndex + (event.key === 'ArrowUp' ? 1 : -1);
    if (next < 0 || next >= rate.options.length) return;
    rate.selectedIndex = next;
    rate.dispatchEvent(new Event('change'));
  });
  if ('speechSynthesis' in window) window.speechSynthesis.addEventListener('voiceschanged', updateVoices);
  window.addEventListener('pagehide', stop);
  updateVoices();
  reload().then(() => { if (!('speechSynthesis' in window)) updateVoices(); });
})();
