'use strict';

const app = document.querySelector('#app');
const settingsDialog = document.querySelector('#settings-dialog');
const settingsKeyInput = settingsDialog.querySelector('#gemini-key');
const voiceKey = 'duo-grade3-voice-v1';
const completionKey = 'duo-grade3-authored-completed-v1';
const practiceModes = [
  ['matching', '🧩 Ghép cặp từ'],
  ['quiz', '📝 Trắc nghiệm câu'],
  ['listening', '🎧 Nghe và chọn đáp án'],
  ['sentences', '🔤 Xếp từ thành câu'],
  ['translation', '✍️ Dịch Việt → Anh'],
  ['mixed', '🎯 Luyện tổng hợp']
];
const completed = new Set();
let units = [];
let preferredVoice = '';
let unitIndex;
let audioRequest = 0;
let returnToAnswer;
let loadingPage = true;
let duoAccount;
let accountRevision = 0;
try {
  preferredVoice = localStorage.getItem(voiceKey) || '';
} catch {
  // Use the default voice when browser storage is unavailable.
}
try {
  const stored = JSON.parse(localStorage.getItem(completionKey));
  if (Array.isArray(stored)) for (const id of stored) completed.add(id);
} catch {
  // Track completion for this visit when storage is unavailable.
}
const guestProfile = { completed: [...completed], voice: preferredVoice, key: geminiKey };

function saveDuoPreference(field, value) {
  const stored = duoAccount?.save(field, value);
  if (stored !== undefined) return stored;
  guestProfile[field] = value;
  const keys = { completed: completionKey, voice: voiceKey, key: geminiKeyStorage };
  try {
    if (field === 'key' && !value) localStorage.removeItem(keys[field]);
    else localStorage.setItem(keys[field], field === 'completed' ? JSON.stringify(value) : value);
    return true;
  } catch {
    return false;
  }
}

function markCompleted(mode) {
  const id = units[unitIndex].id + '/' + mode;
  if (completed.has(id)) return false;
  completed.add(id);
  saveDuoPreference('completed', [...completed]);
  updateStars();
  return true;
}

function element(tag, text, className) {
  const node = document.createElement(tag);
  node.textContent = text;
  if (className) node.className = className;
  return node;
}

function button(text, action, className) {
  const node = element('button', text, className);
  node.type = 'button';
  node.addEventListener('click', action);
  return node;
}

function stopAudio() {
  audioRequest += 1;
  window.speechSynthesis?.cancel();
}

function englishVoices() {
  return (window.speechSynthesis?.getVoices() || []).filter(voice => /^en([-_]|$)/i.test(voice.lang));
}

function refreshVoices() {
  const select = settingsDialog.querySelector('#voice');
  const voices = englishVoices();
  const automatic = element('option', 'Tự động (ưu tiên Anh–Anh)');
  automatic.value = '';
  select.replaceChildren(automatic);
  for (const voice of voices) {
    const option = element('option', voice.name + ' (' + voice.lang + ')');
    option.value = voice.voiceURI;
    select.append(option);
  }
  select.value = voices.some(voice => voice.voiceURI === preferredVoice) ? preferredVoice : '';
  select.disabled = voices.length === 0;
  const available = Boolean(window.speechSynthesis && window.SpeechSynthesisUtterance);
  settingsDialog.querySelector('#voice-preview').disabled = !available;
  settingsDialog.querySelector('#voice-status').textContent = !available
    ? 'Trình duyệt này chưa hỗ trợ giọng đọc.'
    : voices.length === 0 ? 'Chưa tìm thấy giọng tiếng Anh. Em có thể nghe thử giọng tự động.' : '';
}

function say(text, rate, status) {
  stopAudio();
  status.textContent = '';
  if (!window.speechSynthesis || !window.SpeechSynthesisUtterance) {
    status.textContent = 'Trình duyệt này chưa hỗ trợ giọng đọc. Em có thể thử Chrome hoặc Edge.';
    return;
  }
  const request = audioRequest;
  const speech = new SpeechSynthesisUtterance(text);
  speech.lang = 'en-GB';
  speech.rate = rate;
  const voices = englishVoices();
  const voice = voices.find(voice => voice.voiceURI === preferredVoice)
    || voices.find(voice => /^en[-_]GB$/i.test(voice.lang))
    || voices[0];
  if (voice) {
    speech.voice = voice;
    speech.lang = voice.lang;
  }
  speech.onerror = () => {
    if (request === audioRequest) {
      status.textContent = 'Chưa phát được âm thanh. Hãy thử lại hoặc kiểm tra giọng tiếng Anh trên thiết bị.';
    }
  };
  speechSynthesis.speak(speech);
}

function audioStatus() {
  const status = element('p', '', 'audio-status');
  status.setAttribute('role', 'status');
  return status;
}

function shuffle(items) {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function normalize(text) {
  return text.toLowerCase().replace(/['’.,!?]/g, '').trim().replace(/\s+/g, ' ');
}

function unitStars(id) {
  return practiceModes.filter(([mode]) => completed.has(id + '/' + mode)).length;
}

function updateStars() {
  const total = units.reduce((sum, unit) => sum + unitStars(unit.id), 0);
  const maximum = units.length * practiceModes.length;
  document.querySelector('#stars').textContent = total + '/' + maximum + ' ⭐';
}

function showModeCompletion(control, done) {
  control.classList.toggle('mode-completed', done);
  control.querySelector('small')?.remove();
  if (done) control.append(element('small', '✓ Đã hoàn thành'));
}

function applyAccountProfile(profile) {
  completed.clear();
  for (const id of profile.completed) completed.add(id);
  if (preferredVoice !== profile.voice) {
    stopAudio();
    preferredVoice = profile.voice;
    refreshVoices();
  }
  if (geminiKey !== profile.key) {
    geminiKey = profile.key;
    refreshGeminiStatus(settingsDialog.querySelector('#gemini-settings'));
  }
  if (units.length) updateStars();
  for (const badge of app.querySelectorAll('[data-unit-stars]')) {
    badge.textContent = unitStars(badge.dataset.unitStars) + '/' + practiceModes.length + ' ⭐';
  }
  for (const control of app.querySelectorAll('.mode-grid [data-mode]')) {
    showModeCompletion(control, completed.has(units[unitIndex].id + '/' + control.dataset.mode));
  }
}

async function initializeAccount() {
  const status = document.querySelector('#duo-account-status');
  if (location.protocol === 'file:') {
    status.textContent = 'Mở Duo qua website để đăng nhập Google.';
    return;
  }
  try {
    const { setupDuoAccount } = await import('./account.js');
    duoAccount = setupDuoAccount({
      guest: () => guestProfile,
      apply: applyAccountProfile,
      loading(value, changedAccount) {
        if (changedAccount) accountRevision += 1;
        app.inert = value;
        app.classList.toggle('account-loading', value);
        document.querySelector('#stars').hidden = value;
      }
    });
  } catch {
    status.textContent = 'Chưa tải được Google Sign-In. Duo vẫn lưu trên thiết bị này.';
  }
}

function saveLocation(mode, question, progress) {
  const url = new URL(location.href);
  const unit = units[unitIndex]?.id;
  const params = { unit, mode, question };
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined) url.searchParams.delete(key);
    else url.searchParams.set(key, value);
  }
  const state = { ...history.state, duo: { ...params, progress } };
  try {
    history.replaceState(state, '', url);
  } catch {
    // Some browsers allow only fragment changes when opening a local file.
    if (location.protocol === 'file:') {
      const file = new URL(location.href);
      file.hash = url.search ? 'duo?' + url.searchParams.toString() : '';
      location.replace(file.href);
      history.replaceState(state, '');
    }
  }
}

function openSettings(answerInput) {
  returnToAnswer = answerInput;
  refreshVoices();
  settingsDialog.showModal();
  settingsKeyInput.focus();
}

function setupSettings() {
  const status = settingsDialog.querySelector('#voice-status');
  settingsDialog.addEventListener('close', () => {
    stopAudio();
    settingsKeyInput.value = '';
    if (returnToAnswer?.isConnected) returnToAnswer.focus();
    else app.querySelector('#open-settings')?.focus();
    returnToAnswer = undefined;
  });
  settingsDialog.querySelector('#voice').addEventListener('change', event => {
    stopAudio();
    preferredVoice = event.target.value;
    status.textContent = '';
    if (!saveDuoPreference('voice', preferredVoice)) {
      status.textContent = 'Giọng đọc đã đổi cho lần mở trang này.';
    }
  });
  settingsDialog.querySelector('#voice-preview').addEventListener('click', () => {
    say('Hello! Let’s practise English together.', .9, status);
  });
  configureGemini(settingsDialog.querySelector('#gemini-settings'), () => {
    if (returnToAnswer) settingsDialog.close();
  });
}

function showHome(focus = true) {
  stopAudio();
  unitIndex = undefined;
  saveLocation();
  app.replaceChildren(document.querySelector('#home-template').content.cloneNode(true));
  app.querySelector('#open-settings').addEventListener('click', () => openSettings());
  const grid = app.querySelector('.unit-grid');
  units.forEach(({ id, title, topic, pages, icon }, index) => {
    const card = button('', () => showUnit(index), 'unit');
    const symbol = element('span', icon, 'icon');
    symbol.setAttribute('aria-hidden', 'true');
    const info = element('span', '');
    const name = element('strong', title);
    name.lang = 'en';
    const meta = element('span', '', 'unit-meta');
    const stars = element('small', unitStars(id) + '/' + practiceModes.length + ' ⭐');
    stars.dataset.unitStars = id;
    meta.append(element('small', 'Unit ' + (index + 1) + ' · Trang ' + pages.first),
      stars);
    info.append(meta, name, element('small', topic));
    card.append(symbol, info);
    grid.append(card);
  });
  updateStars();
  if (focus) app.querySelector('h1').focus();
}

function showPanel(title, backLabel, backAction) {
  stopAudio();
  const panel = element('section', '', 'panel');
  const heading = element('h1', title);
  heading.tabIndex = -1;
  panel.append(button(backLabel, backAction, 'back'), heading);
  app.replaceChildren(panel);
  if (!loadingPage) heading.focus();
  return panel;
}

function showUnit(index, referenceOpen = false) {
  unitIndex = index;
  const { id, title, topic, pages, reference, exercises } = units[index];
  const panel = showPanel('Unit ' + id + ' · ' + title, '← Các Unit', showHome);
  panel.append(element('p', topic + ' · Trang ' + pages.first + '–' + pages.last + ' trong sách'));
  const modes = element('div', '', 'mode-grid');
  for (const [mode, label] of practiceModes) {
    const items = exercises[mode];
    const done = completed.has(id + '/' + mode);
    const action = mode === 'matching' ? () => showMatching() : () => openPractice(mode);
    const control = button(label + ' · ' + items.length + (mode === 'matching' ? ' cặp' : ' câu'), action);
    control.dataset.mode = mode;
    showModeCompletion(control, done);
    modes.append(control);
  }
  panel.append(modes);
  const details = element('details', '', 'actions');
  details.open = referenceOpen;
  saveLocation(referenceOpen ? 'reference' : undefined);
  details.addEventListener('toggle', () => {
    if (details.isConnected) saveLocation(details.open ? 'reference' : undefined);
  });
  details.append(element('summary', 'Xem từ vựng và mẫu câu'));
  const status = audioStatus();
  details.append(status);
  for (const [label, entries] of [['Từ vựng', reference.vocabulary], ['Mẫu câu', reference.structures]]) {
    const list = element('ul', '', 'word-list');
    for (const { english, vietnamese } of entries) {
      const row = element('li', '');
      const label = element('span', '');
      const word = element('strong', english);
      word.lang = 'en';
      label.append(word, element('small', vietnamese));
      const play = button('🔊 Nghe', () => say(english, .85, status));
      play.setAttribute('aria-label', 'Nghe cách đọc ' + english);
      row.append(label, play);
      list.append(row);
    }
    details.append(element('h2', label), list);
  }
  panel.append(details);
}

function openPractice(mode, position = 0) {
  const types = { quiz: 'choice', listening: 'listening', sentences: 'sentence', translation: 'translation' };
  const questions = units[unitIndex].exercises[mode].map(item => {
    switch (item.type || types[mode]) {
      case 'choice':
        return { title: item.prompt, lines: item.passage, answer: item.answer, choices: shuffle(item.options) };
      case 'listening':
        return { title: 'Nghe và chọn đáp án', sound: item.audio, answer: item.answer, english: true, choices: shuffle(item.options) };
      case 'dictation':
        return { title: 'Nghe rồi gõ lại', sound: item.audio, answer: item.answer, english: true };
      case 'sentence':
        return { title: 'Xếp từ thành câu', clue: item.hint, answer: item.answer, english: true, tiles: true };
      case 'translation':
        return { title: 'Dịch sang tiếng Anh', clue: item.prompt, translation: true };
    }
  });
  startRound(shuffle(questions), mode, { position });
}

function showMatching(saved = []) {
  const panel = showPanel('Ghép cặp từ', '← Về Unit', () => showUnit(unitIndex));
  panel.append(element('p', 'Chọn một từ tiếng Anh và nghĩa tiếng Việt tương ứng.'));
  const pairs = units[unitIndex].exercises.matching;
  const grid = element('div', '', 'matching-grid');
  const matched = new Set(pairs.filter(pair => saved.includes(pair.english)).map(pair => pair.english));
  const status = element('p', 'Đã ghép ' + matched.size + '/' + pairs.length + ' cặp.', 'feedback');
  status.setAttribute('role', 'status');
  const selected = [null, null];
  const restart = button('Chơi lại', () => showMatching());
  restart.hidden = matched.size < pairs.length;
  saveLocation('matching', undefined, [...matched]);

  function markTile(tile) {
    tile.classList.add('matched');
    tile.disabled = true;
    tile.append(' ✓');
  }

  for (const [column, label] of ['Tiếng Anh', 'Tiếng Việt'].entries()) {
    const group = element('div', '', 'matching-column');
    group.append(element('h2', label));
    for (const pair of shuffle(pairs)) {
      const tile = button(column === 0 ? pair.english : pair.vietnamese, () => {
        const previous = selected[column];
        previous?.tile.setAttribute('aria-pressed', 'false');
        selected[column] = previous?.tile === tile ? null : { pair, tile };
        tile.setAttribute('aria-pressed', String(Boolean(selected[column])));
        if (!selected.every(Boolean)) return;
        const correct = selected[0].pair === selected[1].pair;
        for (const item of selected) {
          item.tile.setAttribute('aria-pressed', 'false');
          if (correct) markTile(item.tile);
        }
        selected.fill(null);
        if (correct) {
          matched.add(pair.english);
          saveLocation('matching', undefined, [...matched]);
        }
        status.classList.toggle('correct', correct);
        status.textContent = correct
          ? 'Đúng rồi! Đã ghép ' + matched.size + '/' + pairs.length + ' cặp.'
          : 'Hai thẻ này chưa khớp. Em thử lại nhé!';
        if (matched.size === pairs.length) {
          markCompleted('matching');
          restart.hidden = false;
          restart.focus();
        } else if (correct) {
          grid.querySelector('button:not(:disabled)').focus();
        }
      }, 'choice');
      tile.lang = column === 0 ? 'en' : 'vi';
      tile.setAttribute('aria-pressed', 'false');
      if (matched.has(pair.english)) markTile(tile);
      group.append(tile);
    }
    grid.append(group);
  }
  panel.append(grid, status, restart);
}

function sentenceTiles(question, onChange) {
  const words = question.answer.split(/\s+/);
  const order = shuffle(words.map((_, index) => index));
  if (order.map(index => words[index]).join(' ') === question.answer) order.push(order.shift());
  const arranged = [];
  const board = element('div', '', 'sentence-board');
  const target = element('div', '', 'tile-row drop-zone');
  const pool = element('div', '', 'tile-row');
  board.append(element('p', 'Kéo hoặc chạm để xếp từ. Chạm từ đã xếp để bỏ ra.'), target, pool);
  let dragged = null;

  function move(id, before = null) {
    if (id === before) return;
    const old = arranged.indexOf(id);
    if (old !== -1) arranged.splice(old, 1);
    if (before !== null) arranged.splice(arranged.indexOf(before), 0, id);
    else arranged.push(id);
    render(id);
  }

  function render(focusId) {
    target.replaceChildren();
    pool.replaceChildren();
    function add(id, placed) {
      const tile = button(words[id], () => {
        if (!placed) move(id);
        else {
          arranged.splice(arranged.indexOf(id), 1);
          render(id);
        }
      }, 'word-tile');
      tile.lang = 'en';
      tile.draggable = true;
      tile.addEventListener('dragstart', event => {
        dragged = id;
        event.dataTransfer.setData('text/plain', words[id]);
        event.dataTransfer.effectAllowed = 'move';
      });
      tile.addEventListener('dragend', () => { dragged = null; });
      if (placed) tile.addEventListener('drop', event => {
        if (dragged === null) return;
        event.preventDefault();
        event.stopPropagation();
        move(dragged, id);
        dragged = null;
      });
      (placed ? target : pool).append(tile);
      if (id === focusId) tile.focus();
    }
    arranged.forEach(id => add(id, true));
    order.filter(id => !arranged.includes(id)).forEach(id => add(id, false));
    onChange(arranged.length === words.length ? arranged.map(id => words[id]).join(' ') : '');
  }

  target.addEventListener('dragover', event => {
    if (dragged !== null) event.preventDefault();
  });
  target.addEventListener('drop', event => {
    if (dragged === null) return;
    event.preventDefault();
    move(dragged);
    dragged = null;
  });
  render();
  return board;
}

function startRound(questions, mode, { position = 0, earnedStar = false, missed = [], review = false } = {}) {
  function saveRound(question) {
    saveLocation(mode, question, { questions, position, earnedStar, missed, review });
  }

  function finish() {
    saveRound('done');
    const correct = questions.length - missed.length;
    const panel = showPanel('🎉 Hoàn thành!', '← Về Unit', () => showUnit(unitIndex));
    panel.append(element('p', 'Em làm đúng ' + correct + '/' + questions.length + ' câu.'));
    if (earnedStar) panel.append(element('p', '⭐ Em nhận được 1 sao!'));
    const actions = element('div', '', 'actions');
    if (missed.length) {
      actions.append(button('Ôn lại câu sai', () => startRound(missed, mode, { review: true }), 'primary'));
    }
    actions.append(button('Luyện lại cả bài', () => openPractice(mode)));
    if (unitIndex + 1 < units.length) actions.append(button('Unit tiếp theo →', () => showUnit(unitIndex + 1)));
    panel.append(actions);
  }

  function render() {
    saveRound(position + 1);
    const question = questions[position];
    let request;
    const panel = showPanel(question.title, '← Về Unit', () => {
      request?.abort();
      showUnit(unitIndex);
    });
    const progress = element('progress', '');
    progress.max = questions.length;
    progress.value = position;
    progress.setAttribute('aria-label', 'Tiến độ luyện tập');
    const label = element('p', 'Câu ' + (position + 1) + ' / ' + questions.length, 'tag');
    panel.insertBefore(label, panel.querySelector('h1'));
    panel.insertBefore(progress, panel.querySelector('h1'));

    if (question.lines) {
      const passage = element('div', '', 'passage');
      passage.lang = 'en';
      passage.append(...question.lines.map(line => element('p', line)));
      panel.append(passage);
    }
    if (question.clue) panel.append(element('p', question.clue, 'passage'));
    if (question.sound) {
      const status = audioStatus();
      const controls = element('div', '', 'actions');
      controls.append(button('🔊 Nghe', () => say(question.sound, .9, status)),
        button('🐢 Nghe chậm', () => say(question.sound, .65, status)));
      panel.append(controls, status);
    }

    const form = element('form', '');
    const choices = element('div', '', 'choices');
    const feedback = element('p', '', 'feedback');
    feedback.setAttribute('role', 'status');
    const actions = element('div', '', 'actions');
    const check = element('button', question.translation ? 'Chấm bằng AI' : 'Kiểm tra', 'primary');
    check.type = 'submit';
    check.disabled = true;
    let answer = '';
    let checked = false;
    let input;
    if (question.tiles) {
      choices.append(sentenceTiles(question, value => {
        answer = value;
        check.disabled = !value;
      }));
    } else if (question.choices) {
      for (const option of question.choices) {
        const choice = button(option, () => {
          answer = option;
          for (const item of choices.children) item.setAttribute('aria-pressed', String(item === choice));
          check.disabled = false;
        }, 'choice');
        choice.setAttribute('aria-pressed', 'false');
        if (question.english) choice.lang = 'en';
        choices.append(choice);
      }
    } else {
      const label = element('label', 'Câu trả lời của em');
      input = element('input', '');
      input.type = 'text';
      input.lang = 'en';
      input.autocomplete = 'off';
      input.spellcheck = false;
      input.setAttribute('autocapitalize', 'off');
      if (question.translation) input.maxLength = 500;
      input.addEventListener('input', () => {
        answer = input.value;
        check.disabled = !answer.trim();
      });
      label.append(input);
      choices.append(label);
    }
    actions.append(check);
    form.append(choices, feedback, actions);
    panel.append(form);
    input?.focus();
    form.addEventListener('submit', async event => {
      event.preventDefault();
      if (checked || request || !answer.trim()) return;
      let grade;
      if (question.translation) {
        const revision = accountRevision;
        if (!geminiKey) {
          feedback.textContent = 'Hãy lưu Gemini API key để chấm câu dịch.';
          openSettings(input);
          return;
        }
        request = new AbortController();
        const timeout = setTimeout(() => request.abort(), 30000);
        check.disabled = true;
        input.readOnly = true;
        feedback.textContent = 'Gemini đang chấm câu dịch…';
        try {
          grade = await gradeTranslation(question.clue, answer.trim(), request.signal);
        } catch (error) {
          if (panel.isConnected) {
            feedback.textContent = error.message;
            input.focus();
          }
          return;
        } finally {
          clearTimeout(timeout);
          request = undefined;
          check.disabled = false;
          input.readOnly = false;
        }
        if (!panel.isConnected || revision !== accountRevision) {
          if (panel.isConnected) feedback.textContent = 'Tài khoản đã thay đổi. Hãy chấm lại câu này.';
          return;
        }
      }
      checked = true;
      if (!review && position === questions.length - 1) {
        earnedStar = markCompleted(mode);
      }
      const correct = grade ? grade.accepted
        : question.choices ? answer === question.answer : normalize(answer) === normalize(question.answer);
      if (!correct) missed.push(question);
      feedback.classList.toggle('correct', correct);
      if (grade) {
        const example = element('strong', grade.example);
        example.lang = 'en';
        feedback.textContent = (correct ? '✓ Đạt. ' : 'Em xem lại nhé. ') + grade.feedback;
        feedback.append(document.createElement('br'), 'Câu dịch mẫu: ', example);
      } else if (correct) {
        feedback.textContent = '✓ Chính xác!';
      } else {
        const expected = element('strong', question.answer);
        if (question.english) expected.lang = 'en';
        feedback.append('Đáp án đúng là ', expected);
      }
      if (input) input.readOnly = true;
      else for (const choice of choices.querySelectorAll('button')) {
        choice.disabled = true;
        choice.draggable = false;
      }
      const next = button(position + 1 === questions.length ? 'Xem kết quả' : 'Tiếp tục', () => {
        position += 1;
        if (position < questions.length) render();
        else finish();
      }, 'primary');
      check.replaceWith(next);
      next.focus();
    });
  }

  if (position === questions.length) finish();
  else render();
}

function restoreLocation() {
  const params = new URLSearchParams(location.protocol === 'file:' && location.hash.startsWith('#duo?')
    ? location.hash.slice(5) : location.search);
  const id = Number(params.get('unit'));
  const index = units.findIndex(unit => unit.id === id);
  if (index === -1) {
    showHome(false);
    return;
  }
  unitIndex = index;
  const mode = params.get('mode');
  const rawQuestion = params.get('question');
  const question = rawQuestion === 'done' ? 'done' : Number(rawQuestion) || undefined;
  const saved = history.state?.duo;
  const progress = saved?.unit === id && saved.mode === mode && saved.question === question
    ? saved.progress : undefined;
  if (mode === 'matching') {
    showMatching(Array.isArray(progress) ? progress : []);
  } else if (practiceModes.some(([key]) => key === mode)) {
    if (progress?.questions?.length) startRound(progress.questions, mode, progress);
    else {
      const size = units[index].exercises[mode].length;
      const position = Number.isInteger(question) && question >= 1 && question <= size ? question - 1 : 0;
      openPractice(mode, position);
    }
  } else {
    showUnit(index, mode === 'reference');
  }
}

window.speechSynthesis?.addEventListener?.('voiceschanged', refreshVoices);
setupSettings();
async function loadUnits() {
  try {
    if (location.protocol === 'file:') {
      await new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'units-offline.js';
        script.onload = resolve;
        script.onerror = reject;
        document.head.append(script);
      });
      units = window.duoOfflineUnits;
    } else {
      units = await Promise.all(Array.from({ length: 10 }, async (_, index) => {
        const id = String(index + 1).padStart(2, '0');
        const response = await fetch('units/unit-' + id + '.json');
        if (!response.ok) throw new Error('Could not load Unit ' + id);
        return response.json();
      }));
    }
    updateStars();
    restoreLocation();
  } catch {
    app.replaceChildren(element('p', 'Chưa mở được bài học. Hãy tải lại trang để thử lại.'));
  } finally {
    loadingPage = false;
  }
}

loadUnits();
initializeAccount();
