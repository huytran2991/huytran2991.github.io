window.lists = {};
window.currentListId = null;
let csrfToken = '';
let speakingConfig = {};
let completedLessons = {};
let configWrite = Promise.resolve();

function normalizeText(t) {
  // Copied lesson text can contain invisible direction/formatting marks.
  return (t || '').replace(/\p{Cf}/gu, '').replace(/[’‘]/g, "'").trim().toLowerCase().replace(/[.,!?;:()"'`]/g, '').replace(/\s+/g, ' ');
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"]/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'}[c]));
}

async function lessonRequest(action, data = {}, query = {}) {
  const params = new URLSearchParams(query).toString();
  const response = await englishPracticeFetch(params ? `lessons.php?${params}` : 'lessons.php', action ? {
    method: 'POST',
    headers: {'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken},
    body: JSON.stringify({...data, action}),
    keepalive: action === 'saveConfig',
    cache: 'no-store'
  } : {cache: 'no-store'});
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'Unable to load Speaking data.');
  csrfToken = result.csrf;
  return result;
}

async function loadLessonProgress(id) {
  if (!id) return;
  const lesson = window.lists[id];
  const {progress} = await lessonRequest(null, {}, {progress: id, revision: lesson.revision});
  lesson.sentences = progress;
  if (progress.length && progress.every(item => item.correctCount > 0)) {
    completedLessons[id] = lesson.revision;
  } else {
    delete completedLessons[id];
  }
}

async function loadLessons(preferredId = window.currentListId, initialize = false) {
  stopPractice();
  const result = await lessonRequest();
  if (initialize) {
    speakingConfig = result.config;
    applySpeakingConfig();
  }
  completedLessons = result.completed;
  window.lists = Object.fromEntries(result.lessons.map(lesson => [lesson.id, {
    name: lesson.name,
    duplicates: lesson.duplicates || [],
    revision: lesson.revision,
    sentences: lesson.lines.map(text => ({text, correctCount: 0, starred: false}))
  }]));
  window.currentListId = [preferredId, speakingConfig.lastLesson, result.lessons[0]?.id]
    .find(id => id && window.lists[id]) || null;
  await loadLessonProgress(window.currentListId);
  window.selectedSentenceIdx = null;
  renderListsUI();
}

async function saveProgress(action, file, index, changes = {}) {
  const lesson = window.lists[file];
  const {progress} = await lessonRequest(action, {file, index, revision: lesson.revision, ...changes});
  Object.assign(lesson.sentences[index], progress[index]);
  if (progress.length && progress.every(item => item.correctCount > 0)) {
    completedLessons[file] = lesson.revision;
  } else {
    delete completedLessons[file];
  }
}

function applySpeakingConfig() {
  if (typeof populateVoices === 'function' && typeof speechSynthesis !== 'undefined') populateVoices();
  if (speakingConfig.rate) document.getElementById('rate').value = speakingConfig.rate;
  document.getElementById('lessonSearch').value = speakingConfig.lessonSearch || '';
  window.lenientMode = speakingConfig.lenientMode === true;
  document.getElementById('lenientMode').checked = window.lenientMode;
  document.getElementById('acceptedWordsEditor').hidden = !window.lenientMode;
}

function saveConfig(config) {
  Object.assign(speakingConfig, config);
  const write = configWrite.then(() => lessonRequest('saveConfig', {config}));
  configWrite = write.catch(() => {});
  return write;
}

window.acceptedWordsReady = false;
window.acceptedWordGroups = [];
window.lenientMode = false;
let acceptedWordsRevision = null;
let acceptedWordsText = '';

async function acceptedWordsRequest(data) {
  const response = await englishPracticeFetch('accepted-words.php', data ? {
    method: 'POST',
    headers: {'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken},
    body: JSON.stringify(data),
    cache: 'no-store'
  } : {cache: 'no-store'});
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'Unable to load accepted words.');
  csrfToken = result.csrf;
  return result;
}

function applyAcceptedWords(result) {
  acceptedWordsRevision = result.revision;
  acceptedWordsText = result.text;
  window.acceptedWordGroups = result.groups;
  window.acceptedWordsReady = true;
  document.getElementById('acceptedWords').value = result.text;
  for (const id of ['acceptedWords', 'saveAcceptedWords', 'lenientMode']) {
    document.getElementById(id).disabled = false;
  }
}
