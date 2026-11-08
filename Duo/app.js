'use strict';

const app = document.querySelector('#app');
const storageKey = 'duo-grade3-best-v1';
let best = {};
let unitIndex;
let audioRequest = 0;
try {
  const stored = JSON.parse(localStorage.getItem(storageKey));
  best = stored && typeof stored === 'object' ? stored : {};
} catch {
  // Practice still works when browser storage is unavailable.
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
  const voices = speechSynthesis.getVoices();
  const voice = voices.find(voice => /^en-GB$/i.test(voice.lang))
    || voices.find(voice => /^en([-_]|$)/i.test(voice.lang));
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
  panel.append(button('Bắt đầu luyện · 8 câu', () => startRound(makeQuestions()), 'primary'));
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
  const [listen, dictation, readOne, readTwo, writeOne, writeTwo] = shuffle(words);
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
  return [
    { title: 'Nghe và chọn chữ em nghe được', sound: listen[0], answer: listen[0], english: true, choices: choices(listen, 0) },
    reading(readOne), writing(writeOne),
    ...shuffle(dialogues).map(([first, second, title, answer, ...others]) => ({
      title, lines: [first, second], answer, choices: shuffle([answer, ...others])
    })),
    { title: 'Nghe rồi gõ lại', sound: dictation[0], answer: dictation[0], english: true },
    reading(readTwo), writing(writeTwo)
  ];
}

function startRound(questions, review = false) {
  let position = 0;
  const missed = [];

  function finish() {
    const correct = questions.length - missed.length;
    const stars = correct === questions.length ? 3 : correct >= 6 ? 2 : correct >= 4 ? 1 : 0;
    if (!review && stars > (best[unitIndex] || 0)) {
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
    if (!review && stars) panel.append(element('p', '⭐ Em nhận được ' + stars + ' sao!'));
    const actions = element('div', '', 'actions');
    if (missed.length) {
      actions.append(button('Ôn lại câu sai', () => startRound(missed, true), 'primary'));
    }
    actions.append(button('Luyện lại cả bài', () => startRound(makeQuestions())));
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
    if (question.choices) {
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
      else for (const choice of choices.children) choice.disabled = true;
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

showHome(false);
