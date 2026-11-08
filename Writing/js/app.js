(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  let results = {};
  const drafts = new Map();
  let lessons = [], lesson = null, position = 0, csrf = '', available = false;
  let models = {}, selectedModel = '', selection = null;
  const files = new PracticeFiles(error => { $('status').textContent = error.message; });
  let progressEpoch = 0;
  let checked = null, accepted = false, pending = null, sequence = 0, loading = false;
  let transfer = null, creating = false;

  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  let dictation = null;

  function dictationStatus(message) {
    $('dictation-status').textContent = message;
    $('dictation-status').hidden = !message;
  }
  function cancelDictation() {
    if (!dictation) return;
    const recognition = dictation;
    dictation = null;
    recognition.abort();
  }
  function toggleDictation() {
    if (dictation) {
      dictation.stop();
      return;
    }
    const answer = $('answer');
    const recognition = new SpeechRecognition();
    recognition.lang = 'en-US';
    recognition.continuous = false;
    recognition.interimResults = false;
    let inserted = false;
    recognition.onresult = event => {
      if (dictation !== recognition || answer.disabled || inserted) return;
      const result = event.results[event.resultIndex];
      if (!result.isFinal) return;
      const transcript = result[0].transcript.trim();
      if (!transcript) return;
      inserted = true;
      const separator = answer.value && !/\s$/.test(answer.value) ? ' ' : '';
      const remaining = answer.maxLength - answer.value.length;
      if (remaining <= separator.length) {
        dictationStatus('The translation has reached its character limit.');
        return;
      }
      answer.value += (separator + transcript).slice(0, remaining);
      answer.dispatchEvent(new Event('input', {bubbles: true}));
      answer.focus();
      dictationStatus('');
    };
    recognition.onerror = event => {
      if (dictation !== recognition) return;
      dictationStatus(event.error === 'not-allowed'
        ? 'Allow microphone access in your browser to dictate.'
        : event.error === 'no-speech'
          ? 'No speech detected. Try again.'
          : 'Dictation failed. Check your microphone and try again.');
    };
    recognition.onend = () => {
      if (dictation !== recognition) return;
      dictation = null;
      if ($('dictation-status').textContent === 'Listening…') dictationStatus('');
      controls();
    };
    try {
      recognition.start();
      dictation = recognition;
      dictationStatus('Listening…');
      controls();
    } catch {
      dictationStatus('Could not start dictation. Try again.');
    }
  }

  function sentence() { return lesson?.sentences[position]; }
  function currentKey() { return sentence() ? Writing.key(lesson, sentence()) : ''; }
  async function loadProgress(item) {
    const epoch = ++progressEpoch;
    results = {};
    if (!item) return;
    const values = await files.lesson('lesson', item);
    if (epoch === progressEpoch) results = values;
  }
  async function selectLesson(item) {
    lesson = item;
    position = 0;
    const progress = loadProgress(item);
    renderSentence();
    try {
      await progress;
      renderProgress();
    } catch (error) { $('status').textContent = error.message; }
  }
  async function markAccepted(receipt) {
    const epoch = progressEpoch;
    try {
      const values = await files.lesson('mark', lesson, {sentence: sentence().id, receipt});
      if (epoch === progressEpoch) {
        results = values;
        renderProgress();
      }
    } catch (error) { $('status').textContent = error.message; }
  }
  function formatSuggestions(value) {
    if (!/^1\.[ \t]*\S/.test(value.trim())) return value;
    let next = 2;
    // Some AI responses put numbered alternatives on one line despite the prompt.
    return value.replace(/\s*([23])\.[ \t]*(?=[A-Za-z"'“‘])/g, (match, number) => {
      if (Number(number) !== next) return match;
      next++;
      return '\n' + number + '. ';
    });
  }
  function feedback(message, success = false) {
    $('feedback').replaceChildren();
    $('feedback').textContent = message;
    $('feedback').className = 'feedback' + (success ? ' success' : '');
    $('feedback').hidden = false;
  }
  function cancelReview() {
    if (transfer?.controller) transfer.controller.abort();
    transfer = null;
    $('transfer-actions').hidden = true;
    $('transfer-status').hidden = true;
    $('transfer-status').replaceChildren();
    sequence++;
    if (pending) { clearTimeout(pending.timer); pending.controller.abort(); pending = null; }
    $('ai-review').textContent = 'AI review';
    $('feedback').removeAttribute('aria-busy');
  }
  function controls() {
    $('create').disabled = loading || creating || !csrf;
    $('reload').disabled = loading || creating;
    const active = !!sentence() && !loading;
    const hasAnswer = $('answer').value.trim() !== '';
    $('answer').disabled = !active;
    if (!active && dictation) {
      cancelDictation();
      dictationStatus('');
    }
    $('dictate').disabled = !active || !SpeechRecognition;
    $('dictate').setAttribute('aria-pressed', String(!!dictation));
    $('model').disabled = loading || Object.keys(models).length === 0;
    $('previous').disabled = !active || position === 0;
    $('next').disabled = !active || position === lesson.sentences.length - 1;
    $('clear-all').disabled = !active;
    $('ai-review').disabled = !active || !available || !Object.hasOwn(models, selectedModel) || !!pending || !!dictation || !hasAnswer || (accepted && checked === $('answer').value);
    const canTransfer = active && accepted && checked === $('answer').value && transfer?.key === currentKey();
    $('transfer-actions').hidden = !canTransfer;
    for (const target of ['Speaking', 'Listening']) {
      const button = $('add-' + target.toLowerCase());
      const added = transfer?.completed.has(target);
      button.disabled = !canTransfer || transfer.busy || added;
      button.textContent = added ? `Added to ${target}` : `Add to ${target}`;
    }
  }
  function modelStatus() {
    $('ai-status').hidden = available;
    $('ai-status').textContent = available
      ? ''
      : 'AI is unavailable. Reload after checking the server connection or credential to review your translation.';
  }
  function filterLessons() {
    const query = $('lesson-search').value.trim().toLocaleLowerCase();
    let visible = 0;
    for (const button of $('lessons').querySelectorAll('button')) {
      button.hidden = !button.textContent.toLocaleLowerCase().includes(query);
      if (!button.hidden) visible++;
    }
    $('search-empty').hidden = !lessons.length || visible > 0;
  }
  function renderProgress() {
    $('lessons').replaceChildren();
    for (const item of lessons) {
      const done = files.done(item);
      const button = document.createElement('button');
      button.type = 'button'; button.className = 'lesson';
      button.classList.toggle('active', lesson?.id === item.id);
      button.classList.toggle('completed', item.sentences.length > 0 && done === item.sentences.length);
      button.setAttribute('aria-pressed', String(lesson?.id === item.id));
      button.disabled = loading;
      const title = document.createElement('strong'); title.textContent = item.title;
      const count = document.createElement('span'); count.className = 'small'; count.textContent = `${done} / ${item.sentences.length} completed`;
      button.append(title, count);
      button.addEventListener('click', () => selectLesson(item));
      $('lessons').append(button);
    }
    if (!lessons.length) $('lessons').textContent = 'No lessons found. Create a lesson below.';
    filterLessons();
    $('sentences').replaceChildren();
    const done = lesson?.sentences.filter(line => results[line.id] === 'ai').length || 0;
    $('completed').textContent = `${done} / ${lesson?.sentences.length || 0} completed`;
    $('progress').max = lesson?.sentences.length || 1; $('progress').value = done;
    lesson?.sentences.forEach((line, index) => {
      const isAccepted = results[line.id] === 'ai';
      const button = document.createElement('button'); button.type = 'button';
      button.className = 'sentence'; button.classList.toggle('correct', isAccepted);
      button.classList.toggle('selected', index === position);
      button.textContent = `${index + 1}${isAccepted ? ' ✓' : ''}`;
      button.setAttribute('aria-label', `Sentence ${index + 1}${isAccepted ? ', AI accepted' : ''}`);
      if (index === position) button.setAttribute('aria-current', 'step');
      button.disabled = loading;
      button.addEventListener('click', () => navigate(index)); $('sentences').append(button);
    });
  }
  function renderSentence(saveSelection = true) {
    cancelDictation();
    dictationStatus('');
    cancelReview(); checked = null; accepted = false;
    $('feedback').hidden = true; $('feedback').replaceChildren();
    $('lesson-title').textContent = lesson?.title || 'Choose a lesson';
    $('position').textContent = sentence() ? `${position + 1} / ${lesson.sentences.length}` : '0 / 0';
    $('source').textContent = sentence()?.vi || 'Choose a lesson to start.';
    $('answer').value = drafts.get(currentKey()) || '';
    renderProgress(); controls();
    if (lesson && saveSelection) {
      selection = {lessonId: lesson.id, sentenceId: sentence()?.id || null};
      files.config({selection});
    }
  }
  function navigate(index) {
    if (!lesson || loading || index < 0 || index >= lesson.sentences.length) return;
    position = index; renderSentence(); $('answer').focus();
  }
  function waitForRetry(signal) {
    return new Promise((resolve, reject) => {
      const aborted = () => {
        clearTimeout(timer);
        signal.removeEventListener('abort', aborted);
        reject(new DOMException('Review cancelled.', 'AbortError'));
      };
      const timer = setTimeout(() => {
        signal.removeEventListener('abort', aborted);
        resolve();
      }, 3000);
      signal.addEventListener('abort', aborted, {once: true});
      if (signal.aborted) aborted();
    });
  }
  async function review() {
    if ($('ai-review').disabled) return;
    const capturedKey = currentKey(), answer = $('answer').value, requestSequence = ++sequence;
    const requestModel = selectedModel;
    const controller = new AbortController();
    const operation = {controller, timer: null};
    const payload = JSON.stringify({lesson: lesson.id, revision: lesson.revision, sentence: sentence().id, answer, model: requestModel});
    const isCurrent = () => requestSequence === sequence && capturedKey === currentKey() && answer === $('answer').value && selectedModel === requestModel;
    const maxRetries = 3;
    pending = operation; $('ai-review').textContent = 'Reviewing…';
    feedback(`${models[requestModel]} is reviewing your meaning, grammar and wording… Attempt 1/4.`); $('feedback').setAttribute('aria-busy', 'true'); controls();
    try {
      let data;
      for (let retry = 0; retry <= maxRetries; retry++) {
        if (!isCurrent()) return;
        if (retry > 0) {
          $('ai-review').textContent = `Retrying ${retry}/${maxRetries}…`;
          feedback(`Retry ${retry}/${maxRetries} in progress — attempt ${retry + 1}/4.`);
        }
        operation.timer = setTimeout(() => controller.abort(), 50000);
        const response = await englishPracticeFetch('review.php', {method: 'POST', credentials: 'same-origin', signal: controller.signal,
          headers: {'Content-Type': 'application/json', 'X-CSRF-Token': csrf}, body: payload});
        data = null;
        try { data = await response.json(); }
        catch (_) { if (response.ok) throw new Error('AI returned an unreadable response. Please try again.'); }
        clearTimeout(operation.timer); operation.timer = null;
        if (!isCurrent()) return;
        if (response.ok) break;
        const status = Number.isInteger(data?.serviceStatus) ? data.serviceStatus : response.status;
        const retryable = data?.retryable === true
          || (data?.retryable !== false && response.status >= 500 && response.status <= 599);
        if (retryable && retry < maxRetries) {
          $('ai-review').textContent = `Retry ${retry + 1}/${maxRetries} in 3s…`;
          feedback(`AI service error (HTTP ${status}). Retrying in 3 seconds — retry ${retry + 1}/${maxRetries}.`);
          await waitForRetry(controller.signal);
          continue;
        }
        const message = typeof data?.error === 'string' ? data.error : `AI review failed (HTTP ${status}).`;
        throw new Error(message + (retryable ? ' All 3 retries failed (4 attempts total). Please try again later.' : ''));
      }
      const row = data?.review;
      if (data?.model !== undefined && data.model !== requestModel) {
        throw new Error('AI returned a review from a different model. Please try again.');
      }
      if (!row || !['accepted', 'needs_revision', 'incorrect'].includes(row.verdict)
        || ['meaning', 'grammar', 'naturalness', 'suggested_answer'].some(field => typeof row[field] !== 'string' || !row[field].trim())) {
        throw new Error('AI returned an invalid review. No progress was changed.');
      }
      accepted = row.verdict === 'accepted';
      checked = answer;
      transfer = accepted && typeof data.transferToken === 'string' && /^[a-f0-9]{64}$/.test(data.transferToken)
        ? {token: data.transferToken, key: capturedKey, completed: new Set(), busy: false, controller: null} : null;
      if (accepted && transfer) {
        await markAccepted(transfer.token);
        if (!isCurrent()) return;
      }
      feedback({accepted: 'AI accepted your translation.', needs_revision: 'Your translation needs revision.', incorrect: 'The meaning needs correction.'}[row.verdict], accepted);
      const verdict = document.createElement('strong');
      verdict.className = 'review-verdict'; verdict.textContent = $('feedback').textContent;
      const divider = document.createElement('hr'); divider.className = 'review-divider';
      $('feedback').replaceChildren(verdict, divider);
      for (const [field, label] of [['meaning', 'Meaning'], ['grammar', 'Grammar'], ['naturalness', 'Naturalness'], ['suggested_answer', 'Suggested translations']]) {
        const paragraph = document.createElement('p');
        const heading = document.createElement('strong'); heading.textContent = label + ': ';
        const text = document.createElement('span'); text.textContent = field === 'suggested_answer' ? formatSuggestions(row[field]) : row[field]; text.lang = field === 'suggested_answer' ? 'en' : 'vi';
        if (field === 'suggested_answer') text.className = 'suggested-translations';
        paragraph.append(heading, text); $('feedback').append(paragraph);
      }
    } catch (error) {
      if (requestSequence === sequence) feedback(error.name === 'AbortError' ? 'AI review timed out. Please try again.' : error.message);
    } finally {
      clearTimeout(operation.timer);
      if (requestSequence === sequence) { pending = null; $('ai-review').textContent = 'AI review'; $('feedback').removeAttribute('aria-busy'); controls(); }
    }
  }
  async function addToPractice(target) {
    const button = $('add-' + target.toLowerCase());
    if (!transfer || button.disabled || !accepted || checked !== $('answer').value || transfer.key !== currentKey()) return;
    const operation = transfer;
    operation.busy = true;
    operation.controller = new AbortController();
    const timer = setTimeout(() => operation.controller.abort(), 20000);
    $('transfer-status').hidden = false;
    $('transfer-status').textContent = `Adding your accepted translation to ${target}…`;
    controls();
    try {
      const response = await englishPracticeFetch('transfer.php', {method: 'POST', credentials: 'same-origin', signal: operation.controller.signal,
        headers: {'Content-Type': 'application/json', 'X-CSRF-Token': csrf},
        body: JSON.stringify({target, transferToken: operation.token})});
      const data = await response.json();
      if (transfer !== operation) return;
      if (!response.ok) throw new Error(typeof data.error === 'string' ? data.error : 'Unable to add this translation. Try again.');
      if (data.target !== target || typeof data.file !== 'string' || !/^From Writing_\d{4}_\d{2}_\d{2}\.txt$/.test(data.file) || typeof data.added !== 'boolean') {
        throw new Error('Unable to confirm the saved translation. Try again.');
      }
      operation.completed.add(target);
      $('transfer-status').textContent = `${data.added ? 'Added to' : 'Already in'} ${target} / ${data.file.slice(0, -4)}. `;
      const link = document.createElement('a');
      link.href = `../${target}/`; link.target = '_blank'; link.rel = 'noopener'; link.textContent = `Open ${target}`;
      $('transfer-status').append(link);
    } catch (error) {
      if (transfer === operation) $('transfer-status').textContent = error.name === 'AbortError'
        ? 'Saving timed out. Try again; duplicate sentences will not be added.' : error.message;
    } finally {
      clearTimeout(timer);
      if (transfer === operation) { operation.busy = false; operation.controller = null; controls(); }
    }
  }
  async function load(selectedId = null) {
    if (loading) return;
    cancelReview(); loading = true; $('reload').disabled = true;
    $('feedback').hidden = true; controls(); renderProgress();
    $('status').textContent = 'Loading lessons…';
    const previousLesson = lesson?.id, previousLine = sentence()?.id;
    let loaded = false;
    try {
      const response = await englishPracticeFetch('lessons.php', {credentials: 'same-origin', cache: 'no-store'});
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Unable to load lessons.');
      if (!Array.isArray(data.lessons)) throw new Error('Invalid lesson response.');
      lessons = data.lessons; csrf = data.csrf; available = data.aiAvailable === true;
      if (!data.models || typeof data.models !== 'object' || Array.isArray(data.models) || !Object.hasOwn(data.models, data.model)) {
        throw new Error('Unable to load the available review models.');
      }
      const config = await files.open(csrf);
      selectedModel = config.model;
      selection = config.selection;
      $('lesson-search').value = config.lessonSearch || '';
      const previousId = selectedId ?? previousLesson ?? selection?.lessonId;
      const previousSentence = previousLine ?? selection?.sentenceId;
      models = data.models;
      if (!Object.hasOwn(models, selectedModel)) selectedModel = data.model;
      $('model').replaceChildren();
      for (const [id, label] of Object.entries(models)) {
        const option = document.createElement('option'); option.value = id; option.textContent = label; $('model').append(option);
      }
      $('model').value = selectedModel;
      modelStatus();
      lesson = lessons.find(item => item.id === previousId) || lessons[0] || null;
      position = lesson && lesson.id === previousId ? Math.max(0, lesson.sentences.findIndex(line => line.id === previousSentence)) : 0;
      await loadProgress(lesson);
      loaded = true;
      $('status').textContent = lessons.length ? `${lessons.length} lessons loaded.` : 'No .txt lessons found.';
    } catch (error) {
      $('status').textContent = error.message;
      // Keep drafts readable, but never send AI requests with a stale session.
      available = false;
      $('ai-status').hidden = false;
      $('ai-status').textContent = 'AI is unavailable until lessons reload successfully.';
    } finally { loading = false; $('reload').disabled = false; renderSentence(loaded); }
  }
  $('create-lesson').addEventListener('submit', async event => {
    event.preventDefault();
    if ($('create').disabled) return;
    creating = true; controls();
    $('create-status').textContent = 'Creating lesson…';
    try {
      const response = await englishPracticeFetch('lessons.php', {method: 'POST', credentials: 'same-origin',
        headers: {'Content-Type': 'application/json', 'X-CSRF-Token': csrf},
        body: JSON.stringify({action: 'create', name: $('file-name').value.trim(), content: $('file-content').value})});
      const data = await response.json();
      if (!response.ok || typeof data.selected !== 'string') throw new Error(data.error || 'Unable to create lesson.');
      $('file-name').value = ''; $('file-content').value = '';
      $('lesson-search').value = '';
      await files.config({lessonSearch: ''});
      await load(data.selected);
      $('create-status').textContent = 'Lesson created.';
    } catch (error) { $('create-status').textContent = error.message; }
    finally { creating = false; controls(); }
  });
  $('dictate').hidden = !SpeechRecognition;
  $('dictate').addEventListener('click', toggleDictation);
  $('answer-form').addEventListener('submit', event => { event.preventDefault(); review(); });
  $('add-speaking').addEventListener('click', () => addToPractice('Speaking'));
  $('add-listening').addEventListener('click', () => addToPractice('Listening'));
  $('answer').addEventListener('input', () => {
    cancelReview(); checked = null; accepted = false;
    drafts.set(currentKey(), $('answer').value); $('feedback').hidden = true; controls();
  });
  $('answer').addEventListener('keydown', event => {
    if (event.key !== 'Enter' || event.shiftKey || event.isComposing) return;
    event.preventDefault();
    if (event.repeat || event.ctrlKey || event.metaKey || event.altKey) return;
    if (accepted && checked === $('answer').value) navigate(position + 1); else review();
  });
  $('previous').addEventListener('click', () => navigate(position - 1));
  $('next').addEventListener('click', () => navigate(position + 1));
  $('reload').addEventListener('click', () => load());
  $('lesson-search').addEventListener('input', () => {
    filterLessons();
    files.config({lessonSearch: $('lesson-search').value});
  });
  $('model').addEventListener('change', () => {
    cancelReview(); selectedModel = $('model').value; checked = null; accepted = false;
    $('feedback').hidden = true; files.config({model: selectedModel}); modelStatus(); controls();
  });
  $('clear-all').addEventListener('click', () => {
    if (!lesson || loading) return;
    const item = lesson;
    const epoch = progressEpoch;
    for (const line of item.sentences) drafts.delete(Writing.key(item, line));
    renderSentence(false);
    files.lesson('clear', item).then(values => {
      if (epoch !== progressEpoch) return;
      results = values;
      renderProgress();
    }).catch(error => { $('status').textContent = error.message; });
  });
  window.addEventListener('pagehide', () => {
    const wasPending = !!pending;
    cancelReview();
    if (wasPending) { $('feedback').hidden = true; controls(); }
  });
  load();
})();
