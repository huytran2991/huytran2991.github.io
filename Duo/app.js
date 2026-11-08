'use strict';

const app = document.querySelector('#app');
const storageKey = 'duo-grade3-best-v1';
const voiceKey = 'duo-grade3-voice-v1';
let best = {};
let preferredVoice = '';
let unitIndex;
let audioRequest = 0;
try {
  const stored = JSON.parse(localStorage.getItem(storageKey));
  best = stored && typeof stored === 'object' ? stored : {};
} catch {
  // Practice still works when browser storage is unavailable.
}
try {
  preferredVoice = localStorage.getItem(voiceKey) || '';
} catch {
  // Use the default voice when browser storage is unavailable.
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
  const select = app.querySelector('#voice');
  if (!select) return;
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
  app.querySelector('#voice-preview').disabled = !available;
  app.querySelector('#voice-status').textContent = !available
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

function updateStars() {
  const total = units.reduce((sum, _, index) => sum + (best[index] || 0), 0);
  document.querySelector('#stars').textContent = '⭐ ' + total + ' / 30 sao';
}

function showHome(focus = true) {
  stopAudio();
  app.replaceChildren(document.querySelector('#home-template').content.cloneNode(true));
  const status = app.querySelector('#voice-status');
  app.querySelector('#voice').addEventListener('change', event => {
    stopAudio();
    preferredVoice = event.target.value;
    status.textContent = '';
    try {
      localStorage.setItem(voiceKey, preferredVoice);
    } catch {
      status.textContent = 'Giọng đọc đã đổi cho lần mở trang này.';
    }
  });
  app.querySelector('#voice-preview').addEventListener('click', () => {
    say('Hello! Let’s practise English together.', .9, status);
  });
  refreshVoices();
  const grid = app.querySelector('.unit-grid');
  units.forEach(([title, topic, page, icon], index) => {
    const card = button('', () => showUnit(index), 'unit');
    const symbol = element('span', icon, 'icon');
    symbol.setAttribute('aria-hidden', 'true');
    const info = element('span', '');
    const name = element('strong', title);
    name.lang = 'en';
    info.append(element('small', 'Unit ' + (index + 1) + ' · Trang ' + page), name,
      element('small', topic + (best[index] ? ' · ⭐ ' + best[index] + '/3' : '')));
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
  heading.focus();
  return panel;
}

function showUnit(index) {
  unitIndex = index;
  const [title, topic, page, , words] = units[index];
  const panel = showPanel('Unit ' + (index + 1) + ' · ' + title, '← Các Unit', showHome);
  panel.append(element('p', topic + ' · Trang ' + page + ' trong sách'));
  const modes = element('div', '', 'mode-grid');
  modes.append(
    button('🎯 Luyện tổng hợp · 16 câu', () => startRound(makeQuestions()), 'primary'),
    button('📝 Trắc nghiệm · 8 câu', () => startRound(makeQuiz(), false, makeQuiz)),
    button('🧩 Ghép cặp từ · 8 cặp', showMatching),
    button('🔤 Xếp từ thành câu · 8 câu', () => startRound(makeSentences(), false, makeSentences))
  );
  panel.append(modes);
  const list = element('ul', '', 'word-list');
  const status = audioStatus();
  for (const [english, meaning] of words) {
    const row = element('li', '');
    const label = element('span', '');
    const word = element('strong', english);
    word.lang = 'en';
    label.append(word, element('small', meaning));
    const play = button('🔊 Nghe', () => say(english, .85, status));
    play.setAttribute('aria-label', 'Nghe cách đọc ' + english);
    row.append(label, play);
    list.append(row);
  }
  const details = element('details', '', 'actions');
  details.append(element('summary', 'Xem từ vựng và mẫu câu'), status, list);
  panel.append(details);
}

function makeQuestions() {
  const [, , , , words, dialogues] = units[unitIndex];
  const sample = shuffle(words);
  const choices = (pair, column) => shuffle([
    pair[column],
    ...shuffle(words.filter(word => word !== pair)).slice(0, 2).map(word => word[column])
  ]);
  const reading = pair => ({
    title: 'Đọc và chọn nghĩa đúng', lines: [pair[0]], answer: pair[1], choices: choices(pair, 1)
  });
  const writing = pair => ({
    title: 'Gõ từ hoặc câu tiếng Anh theo nghĩa gợi ý', clue: pair[1], answer: pair[0], english: true
  });
  const listening = sample.slice(0, 4).map(pair => ({
    title: 'Nghe rồi gõ lại', sound: pair[0], answer: pair[0], english: true
  }));
  for (const index of [0, 2]) {
    listening[index].title = 'Nghe và chọn chữ em nghe được';
    listening[index].choices = choices(sample[index], 0);
  }
  return shuffle(dialogues).flatMap(([first, second, title, answer, ...others], index) => [
    listening[index],
    reading(sample[index + 4]),
    { title, lines: [first, second], answer, choices: shuffle([answer, ...others]) },
    writing(sample[index + 8])
  ]);
}

function makeQuiz() {
  return makeQuestions().filter(question => question.choices && !question.sound);
}

function makeSentences() {
  const [, , , , words, dialogues] = units[unitIndex];
  const examples = words.filter(([text]) => /[.!?]$/.test(text)).map(([text, clue]) => ({
    answer: text, clue
  }));
  for (const dialogue of dialogues) {
    for (const line of dialogue.slice(0, 2)) {
      const sentences = line.replace(/^[^:]+: /, '').match(/[^.!?]+[.!?]/g) || [];
      examples.push(...sentences.map(answer => ({ answer: answer.trim() })));
    }
  }
  const unique = new Map();
  for (const example of examples) {
    const key = normalize(example.answer);
    if (!unique.has(key)) unique.set(key, example);
  }
  return shuffle([...unique.values()].filter(({ answer }) => answer.split(/\s+/).length >= 3))
    .slice(0, 8).map(example => ({
      ...example, title: 'Xếp từ thành câu', english: true, tiles: true
    }));
}

function showMatching() {
  const panel = showPanel('Ghép cặp từ', '← Về Unit', () => showUnit(unitIndex));
  panel.append(element('p', 'Chọn một từ tiếng Anh và nghĩa tiếng Việt tương ứng.'));
  const pairs = shuffle(units[unitIndex][4].filter(([text]) => !/[.!?]$/.test(text))).slice(0, 8);
  const grid = element('div', '', 'matching-grid');
  const status = element('p', 'Đã ghép 0/' + pairs.length + ' cặp.', 'feedback');
  status.setAttribute('role', 'status');
  const selected = [null, null];
  let matched = 0;
  const restart = button('Chơi lại', showMatching);
  restart.hidden = true;

  for (const [column, label] of ['Tiếng Anh', 'Tiếng Việt'].entries()) {
    const group = element('div', '', 'matching-column');
    group.append(element('h2', label));
    for (const pair of shuffle(pairs)) {
      const tile = button(pair[column], () => {
        const previous = selected[column];
        previous?.tile.setAttribute('aria-pressed', 'false');
        selected[column] = previous?.tile === tile ? null : { pair, tile };
        tile.setAttribute('aria-pressed', String(Boolean(selected[column])));
        if (!selected.every(Boolean)) return;
        const correct = selected[0].pair === selected[1].pair;
        for (const item of selected) {
          item.tile.setAttribute('aria-pressed', 'false');
          if (correct) {
            item.tile.classList.add('matched');
            item.tile.disabled = true;
            item.tile.append(' ✓');
          }
        }
        selected.fill(null);
        if (correct) matched += 1;
        status.classList.toggle('correct', correct);
        status.textContent = correct
          ? 'Đúng rồi! Đã ghép ' + matched + '/' + pairs.length + ' cặp.'
          : 'Hai thẻ này chưa khớp. Em thử lại nhé!';
        if (matched === pairs.length) {
          restart.hidden = false;
          restart.focus();
        } else if (correct) {
          grid.querySelector('button:not(:disabled)').focus();
        }
      }, 'choice');
      tile.lang = column === 0 ? 'en' : 'vi';
      tile.setAttribute('aria-pressed', 'false');
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

function startRound(questions, review = false, makeRound = makeQuestions) {
  let position = 0;
  const missed = [];

  function finish() {
    const correct = questions.length - missed.length;
    const stars = correct === questions.length ? 3
      : correct >= questions.length * .75 ? 2
      : correct >= questions.length * .5 ? 1 : 0;
    const awardsStars = !review && makeRound === makeQuestions;
    if (awardsStars && stars > (best[unitIndex] || 0)) {
      best[unitIndex] = stars;
      try {
        localStorage.setItem(storageKey, JSON.stringify(best));
      } catch {
        // Keep progress for this visit.
      }
      updateStars();
    }
    const panel = showPanel('🎉 Hoàn thành!', '← Về Unit', () => showUnit(unitIndex));
    panel.append(element('p', 'Em làm đúng ' + correct + '/' + questions.length + ' câu.'));
    if (awardsStars && stars) panel.append(element('p', '⭐ Em nhận được ' + stars + ' sao!'));
    const actions = element('div', '', 'actions');
    if (missed.length) {
      actions.append(button('Ôn lại câu sai', () => startRound(missed, true, makeRound), 'primary'));
    }
    actions.append(button('Luyện lại cả bài', () => startRound(makeRound(), false, makeRound)));
    if (unitIndex + 1 < units.length) actions.append(button('Unit tiếp theo →', () => showUnit(unitIndex + 1)));
    panel.append(actions);
  }

  function render() {
    const question = questions[position];
    const panel = showPanel(question.title, '← Về Unit', () => showUnit(unitIndex));
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
    const check = element('button', 'Kiểm tra', 'primary');
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
    form.addEventListener('submit', event => {
      event.preventDefault();
      if (checked || !answer.trim()) return;
      checked = true;
      const correct = question.choices ? answer === question.answer : normalize(answer) === normalize(question.answer);
      if (!correct) missed.push(question);
      feedback.classList.toggle('correct', correct);
      if (correct) {
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

  render();
}

window.speechSynthesis?.addEventListener?.('voiceschanged', refreshVoices);
showHome(false);
