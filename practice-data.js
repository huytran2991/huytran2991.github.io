const encoder = new TextEncoder();
const collator = new Intl.Collator('en', { numeric: true, sensitivity: 'base' });
const moduleName = { listening: 'Listening', speaking: 'Speaking', writing: 'Writing' };
const maxLessonBytes = 1024 * 1024;
const maxListeningBytes = 2 * maxLessonBytes;
const lessonName = /^[\p{L}\p{N}][\p{L}\p{N} _().-]*\.txt$/u;

export const writingModels = {
  'gemma-4-26b-a4b-it': 'Gemma 4 26B A4B IT',
  'gemini-3.1-flash-lite': 'Gemini 3.1 Flash Lite',
  'gemini-3.5-flash-lite': 'Gemini 3.5 Flash Lite'
};
export const speakingReviewModels = {
  'gemini-3.5-flash-lite': 'Gemini 3.5 Flash Lite',
  'gemini-3.1-flash-lite': 'Gemini 3.1 Flash Lite'
};

export class PracticeError extends Error {
  constructor(message, status = 400, retryable = false) {
    super(message);
    this.status = status;
    this.retryable = retryable;
  }
}

export const trim = text => text.replace(/^[ \t\r\n\v\0]+|[ \t\r\n\v\0]+$/g, '');
const stripBOM = text => text.replace(/^\uFEFF/, '');
const linesOf = text => stripBOM(text).split(/\r\n|\r|\n/).map(trim).filter(Boolean);
const length = text => encoder.encode(text).length;
export const validText = (text, limit) =>
  typeof text === 'string' && !!trim(text) && !text.includes('\0') && length(text) <= limit;
const textKey = text => text.trim().replace(/\s+/gu, ' ').toLowerCase();
const appendLines = (text, lines) => text + (text && !/[\r\n]$/.test(text) ? '\n' : '') + lines.join('\n') + '\n';
const lessonFolder = tool => `${moduleName[tool]}/lessons/`;
const statePath = (tool, file) => `data/${tool}/${file}.json`;
const readState = (files, tool, file) => JSON.parse(files[statePath(tool, file)] ?? '{}');
const readMap = (files, tool, file) => ({ ...readState(files, tool, file) });
const writeState = (files, tool, file, state) => { files[statePath(tool, file)] = JSON.stringify(state); };
const ensure = (condition, message, status) => {
  if (!condition) throw new PracticeError(message, status);
};

async function digest(text) {
  const bytes = new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(text)));
  return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
}

function occurrences(lines) {
  const seen = new Map();
  return lines.map(text => {
    const count = seen.get(text) ?? 0;
    seen.set(text, count + 1);
    return [text, count];
  });
}

function duplicates(lines) {
  const groups = new Map();
  lines.forEach((text, index) => {
    const key = textKey(text);
    if (!groups.has(key)) groups.set(key, { text, positions: [] });
    groups.get(key).positions.push(index + 1);
  });
  return [...groups.values()].filter(group => group.positions.length > 1);
}

export async function lessonAt(files, tool, id) {
  if (typeof id !== 'string') return null;
  const content = files[lessonFolder(tool) + id];
  if (typeof content !== 'string') return null;
  const name = id.slice(0, -4);
  const lines = linesOf(content);
  const revision = await digest(content);
  if (tool === 'writing') {
    const sentences = await Promise.all(occurrences(lines).map(async ([vi, count]) => ({
      id: `${await digest(vi)}:${count + 1}`, vi
    })));
    return { id, title: name, revision, sentences };
  }
  if (tool === 'speaking') return { id, name, revision, lines, duplicates: duplicates(lines) };
  return { id, name, revision, lines, content };
}

export function listLessons(files, tool) {
  const prefix = lessonFolder(tool);
  const ids = Object.keys(files).filter(path => path.startsWith(prefix)).map(path => path.slice(prefix.length))
    .filter(id => tool === 'speaking' ? lessonName.test(id) : /\.txt$/i.test(id));
  ids.sort(collator.compare);
  return Promise.all(ids.map(id => lessonAt(files, tool, id)));
}

function newLessonId(name, allowExtension) {
  ensure(typeof name === 'string', 'Enter a lesson name.');
  const clean = trim(name);
  const file = allowExtension && /\.txt$/i.test(clean) ? clean : clean + '.txt';
  ensure(length(file) <= 180 && lessonName.test(file.replace(/\.txt$/i, '.txt')), 'Use a valid lesson name starting with a letter or number.');
  return file;
}

export async function saveTextLesson(files, tool, request) {
  const { action, content } = request;
  const isWriting = tool === 'writing';
  ensure(validText(content, isWriting ? maxLessonBytes : maxListeningBytes), 'Enter nonempty UTF-8 lesson text within the size limit.');
  if (isWriting) {
    const lines = linesOf(content);
    ensure(lines.length >= 1 && lines.length <= 200 && lines.every(line => validText(line, 2000)),
      'Enter 1 to 200 sentences, each at most 2,000 UTF-8 bytes.');
  }
  ensure(action === 'create' || (!isWriting && action === 'update'), 'Invalid lesson action.');
  const id = isWriting ? newLessonId(request.name, true) : request.file;
  ensure(typeof id === 'string' && /\.txt$/i.test(id), 'Use a .txt lesson name.');
  const path = lessonFolder(tool) + id;
  if (action === 'create') {
    ensure(isWriting || newLessonId(id, true) === id, 'Use a .txt name without folders.');
    ensure(!Object.hasOwn(files, path), 'A lesson with this name already exists. Choose another name.', 409);
  } else {
    ensure(typeof files[path] === 'string', 'Lesson not found. Reload the lesson list.', 409);
    ensure(await digest(files[path]) === request.revision, 'This lesson changed elsewhere. Copy your edits and reload.', 409);
  }
  files[path] = content;
  return id;
}

export async function sourceLesson(files, tool, id, revision) {
  const lesson = await lessonAt(files, tool, id);
  ensure(lesson && lesson.revision === revision, 'The lesson has changed. Reload and try again.', 409);
  return lesson;
}

function mergeConfig(files, tool, changes) {
  ensure(changes && typeof changes === 'object', 'Invalid practice settings.');
  const config = readMap(files, tool, 'config');
  const valid = {};
  const names = tool === 'speaking' ? ['lessonSearch', 'voice', 'lastLesson']
    : tool === 'listening' ? ['voice', 'rate', 'lesson', 'lessonSearch'] : ['lessonSearch'];
  for (const key of names) {
    if (typeof changes[key] === 'string' && length(changes[key]) <= 4096) valid[key] = changes[key];
  }
  const selection = changes.selection;
  if (tool === 'listening' && (selection === null || typeof selection === 'string' && length(selection) <= maxListeningBytes)) {
    valid.selection = selection;
  }
  if (tool === 'writing') {
    if (Object.hasOwn(writingModels, changes.model)) valid.model = changes.model;
    if (typeof selection?.lessonId === 'string' && length(selection.lessonId) <= 4096 &&
        (selection.sentenceId === null || typeof selection.sentenceId === 'string' && length(selection.sentenceId) <= 128)) {
      valid.selection = { lessonId: selection.lessonId, sentenceId: selection.sentenceId };
    }
  }
  if (tool === 'speaking') {
    if (typeof changes.lenientMode === 'boolean') valid.lenientMode = changes.lenientMode;
    if (['string', 'number'].includes(typeof changes.rate) && Number(changes.rate) >= .5 && Number(changes.rate) <= 1.7) {
      valid.rate = String(changes.rate);
    }
  }
  const next = { ...config, ...valid };
  if (JSON.stringify(next) !== JSON.stringify(config)) writeState(files, tool, 'config', next);
  return next;
}

async function progressFile(id) {
  const base = id.split('/').at(-1).replace(/\.txt$/, '');
  // PHP generated this label byte-by-byte. Preserve it for previously saved Unicode names.
  const label = Array.from(encoder.encode(base), byte => {
    const char = String.fromCharCode(byte);
    return /[a-zA-Z0-9 _.-]/.test(char) ? char : '_';
  }).join('').slice(0, 90);
  return `progress/${label}--${await digest(id)}`;
}

export async function practiceProgress(files, tool, request, checkAcceptance) {
  const { action } = request;
  const summary = readMap(files, tool, 'completed');
  if (action === 'state') return { config: readMap(files, tool, 'config'), summary };
  if (action === 'config') {
    mergeConfig(files, tool, request.config);
    return {};
  }
  const lesson = await sourceLesson(files, tool, request.lesson, request.revision);
  const writing = tool === 'writing';
  const keys = Object.fromEntries(writing ? lesson.sentences.map(({ id, vi }) => [id, vi])
    : occurrences(lesson.lines).map(pair => [JSON.stringify(pair), true]));
  const file = await progressFile(lesson.id);
  const old = readState(files, tool, file).results ?? {};
  let results = Object.fromEntries(Object.entries(old).filter(([key]) => Object.hasOwn(keys, key)));
  const complete = writing ? 'ai' : 'correct';
  if (action === 'clear') results = {};
  else if (action === 'mark') {
    const key = request.sentence;
    ensure(typeof key === 'string' && Object.hasOwn(keys, key), 'Invalid sentence.');
    if (writing) {
      checkAcceptance(lesson);
      results[key] = complete;
    } else {
      ensure(['correct', 'viewed'].includes(request.result), 'Invalid dictation result.');
      if (results[key] !== 'correct') results[key] = request.result;
    }
  } else ensure(action === 'lesson', 'Invalid practice action.');

  if (action !== 'lesson' && JSON.stringify(results) !== JSON.stringify(old)) {
    const data = { lesson: lesson.id, results };
    if (writing) data.sentences = Object.fromEntries(Object.keys(results).map(key => [key, keys[key]]));
    writeState(files, tool, file, data);
  }
  const done = Object.values(results).filter(value => value === complete).length;
  if (summary[lesson.id]?.revision !== lesson.revision || summary[lesson.id]?.done !== done) {
    summary[lesson.id] = { revision: lesson.revision, done };
    writeState(files, tool, 'completed', summary);
  }
  return { results, done };
}

function speakingProgress(files, lesson) {
  const saved = readState(files, 'speaking', `progress/${lesson.name}`);
  const byText = new Map();
  for (const item of Array.isArray(saved) ? saved : []) {
    if (typeof item?.text !== 'string') continue;
    if (!byText.has(item.text)) byText.set(item.text, []);
    byText.get(item.text).push(item);
  }
  return occurrences(lesson.lines).map(([text, occurrence]) => {
    const item = byText.get(text)?.[occurrence];
    const count = item?.correctCount;
    return { text, correctCount: Number.isSafeInteger(count) && count >= 0 ? count : 0, starred: item?.starred === true };
  });
}

function updateSpeakingSummary(files, summary, lesson, items) {
  const before = summary[lesson.id];
  if (items.length && items.every(item => item.correctCount > 0)) summary[lesson.id] = lesson.revision;
  else delete summary[lesson.id];
  if (summary[lesson.id] !== before) writeState(files, 'speaking', 'completed', summary);
}

function uniqueAdditions(existing, added) {
  const seen = new Set(existing.map(textKey));
  for (const line of added) {
    const key = textKey(line);
    ensure(!seen.has(key), `Duplicate sentence in this lesson or the submitted text: ${line}`);
    seen.add(key);
  }
}

export async function speakingRequest(files, request, query) {
  const tool = 'speaking';
  const completed = readMap(files, tool, 'completed');
  if (!request) {
    if (query.has('progress')) {
      const lesson = await sourceLesson(files, tool, query.get('progress'), query.get('revision'));
      return { progress: speakingProgress(files, lesson) };
    }
    return { lessons: await listLessons(files, tool), selected: null, config: readMap(files, tool, 'config'), completed };
  }

  const { action, file } = request;
  const folder = lessonFolder(tool);
  if (action === 'saveConfig') return { config: mergeConfig(files, tool, request.config) };
  if (action === 'create') {
    const selected = newLessonId(request.name, false);
    ensure(!Object.hasOwn(files, folder + selected), 'This lesson already exists.');
    files[folder + selected] = '';
    return { selected, completed, lessons: await listLessons(files, tool) };
  }

  const lesson = await lessonAt(files, tool, file);
  ensure(lesson, 'This lesson no longer exists. Reload the lesson list.', 409);
  if (!['append', 'replaceSentence'].includes(action)) {
    ensure(lesson.revision === request.revision, 'The lesson has changed. Reload and try again.', 409);
  }
  const { index } = request;
  if (['attempt', 'resetCount', 'setStar'].includes(action)) {
    const items = speakingProgress(files, lesson);
    ensure(Number.isInteger(index) && items[index], 'The sentence no longer exists.', 409);
    if (action === 'attempt') items[index].correctCount = Math.min(Number.MAX_SAFE_INTEGER, items[index].correctCount + 1);
    if (action === 'resetCount') items[index].correctCount = 0;
    if (action === 'setStar') {
      ensure(typeof request.starred === 'boolean', 'Invalid star value.');
      items[index].starred = request.starred;
    }
    writeState(files, tool, `progress/${lesson.name}`, items);
    updateSpeakingSummary(files, completed, lesson, items);
    return { progress: items };
  }

  const path = folder + file;
  const content = files[path];
  let selected = file;
  if (action === 'rename' || action === 'delete') {
    selected = action === 'rename' ? newLessonId(request.name, false) : null;
    if (selected !== file) {
      const progress = statePath(tool, `progress/${lesson.name}`);
      if (selected) {
        const nextProgress = statePath(tool, `progress/${selected.slice(0, -4)}`);
        ensure(!Object.hasOwn(files, folder + selected) && !Object.hasOwn(files, nextProgress), 'This lesson name already exists.');
        files[folder + selected] = content;
        if (Object.hasOwn(files, progress)) files[nextProgress] = files[progress];
      }
      delete files[path];
      delete files[progress];
      if (Object.hasOwn(completed, file)) {
        if (selected) completed[selected] = completed[file];
        delete completed[file];
        writeState(files, tool, 'completed', completed);
      }
    }
  } else {
    let next;
    const { lines } = lesson;
    if (action === 'append') {
      ensure(validText(request.text, 100000), 'Enter at least one sentence, at most 100 KB.');
      const added = linesOf(request.text);
      ensure(added.length, 'Enter at least one sentence.');
      uniqueAdditions(lines, added);
      next = appendLines(content, added);
    } else if (action === 'replaceSentence') {
      ensure(validText(request.text, 100000) && !/[\r\n]/.test(request.text), 'Enter exactly one sentence without line breaks.');
      const matches = lines.filter(line => line === request.oldText);
      ensure(matches.length === 1, 'The original sentence was not found or occurs more than once. Reload the lesson.', 409);
      const replacement = trim(request.text);
      uniqueAdditions(lines.filter(line => line !== request.oldText), [replacement]);
      const parts = content.split(/(\r\n|\n|\r)/);
      const match = parts.findIndex((part, i) => i % 2 === 0 && trim(i === 0 ? stripBOM(part) : part) === request.oldText);
      parts[match] = (match === 0 && content.startsWith('\uFEFF') ? '\uFEFF' : '') + replacement;
      next = parts.join('');
    } else {
      ensure(action === 'removeSentence' && Number.isInteger(index) && index >= 0 && index < lines.length,
        'The sentence to delete was not found.');
      lines.splice(index, 1);
      next = lines.length ? lines.join('\n') + '\n' : '';
    }
    ensure(length(next) <= 1000000, 'The lesson exceeds the 1 MB limit.');
    files[path] = next;
    const updated = await lessonAt(files, tool, file);
    updateSpeakingSummary(files, completed, updated, speakingProgress(files, updated));
  }
  return { selected, completed, lessons: await listLessons(files, tool) };
}

export async function acceptedWords(files, request) {
  const path = 'Speaking/settings/accepted-words.txt';
  let text = files[path] ?? '';
  if (request) {
    ensure(request.revision === await digest(text), 'The word list changed. Reload it before saving.', 409);
    ensure(typeof request.text === 'string' && length(request.text) <= 100000, 'Use UTF-8 text up to 100 KB.');
    text = request.text;
  }
  const groups = [];
  const seen = new Set();
  for (const [index, line] of stripBOM(text).split(/\r\n|\n|\r/).entries()) {
    if (!trim(line)) continue;
    const words = line.split(',').map(word => trim(word.replace(/[’‘]/g, "'")).replace(/[ \t]+/g, ' ').toLowerCase());
    ensure(words.length >= 2, `Line ${index + 1}: enter at least two comma-separated words or phrases.`);
    for (const word of words) {
      ensure(/^[a-z0-9]+(?:['-][a-z0-9]+)*(?: [a-z0-9]+(?:['-][a-z0-9]+)*)*$/.test(word),
        `Line ${index + 1}: use words or phrases separated by commas.`);
      const key = word.replaceAll("'", '');
      ensure(!seen.has(key), `Line ${index + 1}: each word or phrase must appear only once.`);
      seen.add(key);
    }
    groups.push(words);
  }
  if (request) files[path] = text;
  return { text, groups, revision: await digest(text) };
}

export function appendTransfer(files, target, file, sentence) {
  const answer = sentence.trim().replace(/\s+/gu, ' ');
  ensure(answer && !/[\x00-\x1f\x7f]/.test(answer), 'The sentence cannot be transferred.');
  const path = lessonFolder(target) + file;
  const original = files[path] ?? '';
  if (linesOf(original).some(line => textKey(line) === textKey(answer))) return false;
  const next = appendLines(original, [answer]);
  ensure(length(next) <= maxListeningBytes, 'The destination lesson is full.');
  files[path] = next;
  return true;
}

export async function reviewPrompts(files) {
  const prefix = 'SpeakingReview/prompts/';
  const ids = Object.keys(files).filter(path => path.startsWith(prefix)).map(path => path.slice(prefix.length))
    .filter(id => !id.includes('/') && /\.txt$/i.test(id)).sort(collator.compare);
  return Promise.all(ids.map(async id => {
    const source = files[prefix + id];
    ensure(validText(source, 24000), 'A review prompt is empty or exceeds the 24 KB limit.');
    return { id, title: id.slice(0, -4), text: trim(stripBOM(source)), revision: await digest(source) };
  }));
}
