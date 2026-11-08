window.selectedSentenceIdx = null;
window.practiceEpoch = 0;
const listsEl = document.getElementById('lists');
const lessonSearch = document.getElementById('lessonSearch');
const lessonSearchStatus = document.getElementById('lessonSearchStatus');
const selectList = document.getElementById('selectList');
const newListName = document.getElementById('newListName');
const inputSentences = document.getElementById('inputSentences');
const sentencesEl = document.getElementById('sentences');
const voiceSelect = document.getElementById('voiceSelect');
const rateEl = document.getElementById('rate');
const btnShowHideSidebar = document.getElementById('btnShowHideSidebar');
const statusEl = document.getElementById('status');
let busy = false;
document.querySelector('.app').addEventListener('click', event => {
  if (busy && event.target.closest('button')) {
    event.preventDefault();
    event.stopImmediatePropagation();
  }
}, true);

function stopPractice() {
  window.practiceEpoch++;
  if (window.activeRecognition) {
    const active = window.activeRecognition;
    window.activeRecognition = null;
    if (active.rec) active.rec.abort();
  }
  for (const url of Object.values(window.lastRecordedAudios || {})) URL.revokeObjectURL(url);
  window.lastRecordedAudios = {};
  if (window.speechSynthesis) window.speechSynthesis.cancel();
}

async function runAction(action) {
  if (busy) return;
  busy = true;
  document.querySelector('.app').setAttribute('aria-busy', 'true');
  statusEl.textContent = 'Loading…';
  try {
    await action();
    statusEl.textContent = '';
  } catch (error) {
    statusEl.textContent = error.message;
  } finally {
    busy = false;
    document.querySelector('.app').removeAttribute('aria-busy');
  }
}

btnShowHideSidebar.addEventListener('click', () => {
  const open = document.getElementById('sidebar').classList.toggle('active');
  btnShowHideSidebar.style.left = open ? 'min(320px, calc(100vw - 40px))' : '';
  btnShowHideSidebar.textContent = open ? '‹' : '›';
  btnShowHideSidebar.setAttribute('aria-expanded', String(open));
});

function applyLessonFilter() {
  const query = lessonSearch.value.trim().toLowerCase().replace(/\s+/g, ' ');
  let hasMatch = false;
  for (const card of listsEl.children) {
    const filename = card.dataset.lessonId.toLowerCase();
    const title = card.querySelector('strong').textContent.toLowerCase();
    card.hidden = !filename.includes(query) && !title.includes(query);
    if (!card.hidden) hasMatch = true;
  }
  lessonSearchStatus.hidden = !query || hasMatch;
}

lessonSearch.addEventListener('input', () => {
  saveConfig({lessonSearch: lessonSearch.value}).catch(showSaveError);
  applyLessonFilter();
});

function renderListsUI() {
  listsEl.innerHTML = '';
  selectList.innerHTML = '';
  for (const [id, lesson] of Object.entries(window.lists)) {
    const displayName = lesson.name.replace(/-/g, ' ').replace(/\s+/g, ' ').trim();
    const li = document.createElement('div');
    li.className = 'list-item';
    li.dataset.lessonId = id;
    const left = document.createElement('div');
    left.innerHTML = `<strong>${escapeHtml(displayName)}</strong><div class="small">${lesson.sentences.length} sentences</div>`;
    const actions = document.createElement('div');
    actions.className = 'list-item-actions';
    for (const [label, callback] of [['Open', () => selectListById(id)], ['Rename', () => renameList(id)], ['Delete', () => deleteList(id)]]) {
      const button = document.createElement('button');
      button.className = 'btn secondary';
      button.textContent = label;
      button.onclick = callback;
      actions.appendChild(button);
    }
    li.append(left, actions);
    listsEl.appendChild(li);
    const option = document.createElement('option');
    option.value = id;
    option.textContent = displayName;
    selectList.appendChild(option);
  }
  applyLessonFilter();
  selectList.value = window.currentListId || '';
  renderSentences();
}

function selectListById(id) {
  if (!window.lists[id]) return;
  return runAction(async () => {
    stopPractice();
    await loadLessonProgress(id);
    window.currentListId = id;
    window.selectedSentenceIdx = null;
    selectList.value = id;
    renderSentences();
    await saveConfig({lastLesson: id});
  });
}

async function renameList(id) {
  const name = prompt('New lesson name:', window.lists[id].name);
  if (!name?.trim() || name.trim() === window.lists[id].name) return;
  await runAction(async () => {
    stopPractice();
    const result = await lessonRequest('rename', {file: id, name: name.trim(), revision: window.lists[id].revision});
    await loadLessons(result.selected);
    if (window.currentListId === result.selected) await saveConfig({lastLesson: result.selected});
  });
}

async function deleteList(id) {
  if (!id || !confirm('Delete this lesson file from the lessons folder?')) return;
  await runAction(async () => {
    stopPractice();
    await lessonRequest('delete', {file: id, revision: window.lists[id].revision});
    await loadLessons();
  });
}

document.getElementById('btnCreateList').onclick = () => runAction(async () => {
  if (!newListName.value.trim()) throw new Error('Enter a lesson name.');
  const result = await lessonRequest('create', {name: newListName.value.trim()});
  newListName.value = '';
  await loadLessons(result.selected);
  await saveConfig({lastLesson: result.selected});
});
document.getElementById('btnDeleteList').onclick = () => deleteList(window.currentListId);
document.getElementById('btnReloadLists').onclick = () => runAction(() => loadLessons());
selectList.onchange = () => {
  const id = selectList.value;
  selectList.value = window.currentListId || '';
  return selectListById(id);
};
document.getElementById('btnLoadDemo').onclick = () => {
  inputSentences.value = 'This is a cat.\nI like apples.\nShe is reading a book.\nDo you speak English?\nThey went to the market.';
};
document.getElementById('btnAddSentences').onclick = () => runAction(async () => {
  const id = window.currentListId;
  if (!id) throw new Error('Select or create a lesson before adding sentences.');
  if (!inputSentences.value.trim()) throw new Error('Enter at least one sentence.');
  stopPractice();
  await lessonRequest('append', {file: id, text: inputSentences.value});
  inputSentences.value = '';
  await loadLessons(id);
});
document.getElementById('btnClearSentences').onclick = () => { inputSentences.value = ''; };
document.getElementById('btnTestVoice').onclick = () => speak('Hello! Let’s practice speaking English.');
function showSaveError(error) {
  statusEl.textContent = error.message;
}
voiceSelect.onchange = () => saveConfig({voice: voiceSelect.value}).catch(showSaveError);
rateEl.onchange = () => saveConfig({rate: rateEl.value}).catch(showSaveError);
const sentenceSearch = document.getElementById('sentenceSearch');
const sentenceSearchGroup = document.getElementById('sentenceSearchGroup');
const starredOnly = document.getElementById('starredOnly');
let searchLessonId = null;

function applySentenceFilter() {
  const query = sentenceSearch.value.trim().toLowerCase().replace(/\s+/g, ' ');
  const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = query ? new RegExp(`(^|[^\\p{L}\\p{N}_])${escapedQuery}(?=$|[^\\p{L}\\p{N}_])`, 'u') : null;
  const rows = Array.from(sentencesEl.querySelectorAll('.sentence-row'));
  let visible = 0;
  rows.forEach((row, index) => {
    const text = row.querySelector('.sentence-text').textContent.toLowerCase().replace(/\s+/g, ' ');
    const item = window.lists[window.currentListId]?.sentences[index];
    row.hidden = (pattern ? !pattern.test(text) : false) || (starredOnly.checked && !item?.starred);
    if (!row.hidden) visible++;
    if (row.hidden && window.selectedSentenceIdx === index) {
      stopPractice();
      window.selectedSentenceIdx = null;
      row.classList.remove('selected-row');
    }
  });
  document.getElementById('sentenceFilterResults').textContent = `${visible} / ${rows.length} sentences`;
  document.getElementById('noMatchingSentences').hidden = !rows.length || visible > 0;
}
sentenceSearch.addEventListener('input', applySentenceFilter);
starredOnly.addEventListener('change', applySentenceFilter);

// Render sentences
function renderSentences() {
  sentencesEl.innerHTML = '';
  sentenceSearchGroup.hidden = true;
  document.getElementById('noMatchingSentences').hidden = true;
  if (!window.currentListId || !window.lists[window.currentListId]) {
    return sentencesEl.innerHTML = '<div class="small">Select or create a lesson to begin.</div>';
  }

  const lesson = window.lists[window.currentListId];
  const arr = lesson.sentences || [];
  sentenceSearchGroup.hidden = arr.length <= 10;
  if (searchLessonId !== window.currentListId || sentenceSearchGroup.hidden) sentenceSearch.value = '';
  searchLessonId = window.currentListId;
  if (lesson.duplicates?.length) {
    const warning = document.createElement('div');
    warning.className = 'duplicate-warning';
    warning.setAttribute('role', 'status');
    warning.textContent = 'Duplicate sentences found in this lesson: ' + lesson.duplicates.map(group => `Sentences ${group.positions.join(', ')}: “${group.text}”`).join('; ');
    sentencesEl.appendChild(warning);
  }
  if (!arr.length) sentencesEl.innerHTML = '<p class="small">This lesson has no sentences yet. Add sentences above to begin.</p>';
  arr.forEach((item, idx) => {
    const row = document.createElement('div');
    row.className = 'sentence-row';
    row.dataset.sentenceIndex = idx;
    if (window.selectedSentenceIdx === idx) {
      row.className += ' selected-row';
    }
    row.onclick = () => {
      window.selectedSentenceIdx = idx;
      document.querySelectorAll('.sentence-row').forEach(r => r.classList.remove('selected-row'));
      row.classList.add('selected-row');
    };


    const textWrap = document.createElement('div');
    textWrap.className = 'sentence-text';
    textWrap.innerHTML = item.text.split(/(\s+)/).map((tok) => {
      if (tok.trim() === '') return tok;
      return `<span class="word" data-word="${encodeURIComponent(tok)}">${escapeHtml(tok)}</span>`;
    }).join('');

    const icons = document.createElement('div');
    icons.className = 'icons';

    const starBtn = document.createElement('button');
    starBtn.className = 'icon-btn star-sentence';
    const updateStarButton = () => {
      starBtn.textContent = item.starred ? '★' : '☆';
      starBtn.classList.toggle('is-starred', item.starred === true);
      starBtn.setAttribute('aria-pressed', String(item.starred === true));
      starBtn.setAttribute('aria-label', `Star sentence ${idx + 1}`);
      starBtn.title = item.starred ? 'Remove star' : 'Star sentence';
    };
    updateStarButton();
    starBtn.onclick = event => {
      event.stopPropagation();
      return runAction(async () => {
        await saveProgress('setStar', window.currentListId, idx, {starred: !item.starred});
        updateStarButton();
        applySentenceFilter();
        updateCompletionIndicators();
        if (row.hidden) starredOnly.focus();
      });
    };
    row.appendChild(starBtn);

    const playBtn = document.createElement('button');
    playBtn.className = 'icon-btn';
    playBtn.title = 'Play sentence';
    playBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-volume-2"><path d="M11 5L6 9H2v6h4l5 4V5z"></path><path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path><path d="M19.07 4.93a10 10 0 0 1 0 14.14"></path></svg><span class="key-badge">3</span>`;
    playBtn.onclick = () => speak(item.text);

    const micBtn = document.createElement('button');
    micBtn.className = 'icon-btn';
    micBtn.title = 'Record and compare';
    micBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-mic"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"></path><path d="M19 10v1a7 7 0 0 1-14 0v-1"></path><line x1="12" x2="12" y1="19" y2="22"></line></svg><span class="key-badge">2</span>`;
    micBtn.onclick = () => startRecognition(item, row, idx);

    const replayBtn = document.createElement('button');
    replayBtn.className = `icon-btn replay-btn ${window.lastRecordedAudios && window.lastRecordedAudios[idx] ? '' : 'invisible'}`;
    replayBtn.title = 'Replay your recording';
    replayBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-play-circle"><circle cx="12" cy="12" r="10"></circle><polygon points="10 8 16 12 10 16 10 8"></polygon></svg><span class="key-badge">1</span>`;
    replayBtn.onclick = () => {
      if (typeof playRecordedAudio === 'function') {
        playRecordedAudio(idx);
      }
    };

    const resetBtn = document.createElement('button');
    resetBtn.className = 'icon-btn';
    resetBtn.title = 'Reset count';
    resetBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-rotate-ccw"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"></path><path d="M3 3v5h5"></path></svg>`;
    resetBtn.onclick = async () => {
      if (confirm('Reset the correct count to zero?')) {
        await runAction(async () => {
          stopPractice();
          await saveProgress('resetCount', window.currentListId, idx);
          renderSentences();
        });
      }
    };

    const delBtn = document.createElement('button');
    delBtn.className = 'icon-btn';
    delBtn.title = 'Delete sentence';
    delBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-trash-2"><path d="M3 6h18"></path><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path><line x1="10" x2="10" y1="11" y2="17"></line><line x1="14" x2="14" y1="11" y2="17"></line></svg>`;
    delBtn.onclick = async () => {
      if (!confirm('Delete this sentence?')) return;
      await runAction(async () => {
        stopPractice();
        const id = window.currentListId;
        await lessonRequest('removeSentence', {
          file: id, index: idx, revision: window.lists[id].revision
        });
        await loadLessons(id);
      });
    };

    icons.appendChild(replayBtn);
    icons.appendChild(micBtn);
    icons.appendChild(playBtn);
    icons.appendChild(resetBtn);
    icons.appendChild(delBtn);

    const editBtn = document.createElement('button');
    editBtn.className = 'icon-btn edit-sentence';
    editBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m16 3 5 5-13 13H3v-5L16 3Z"></path><path d="m14 5 5 5"></path></svg>';
    editBtn.title = 'Edit sentence';
    editBtn.setAttribute('aria-label', `Edit sentence ${idx + 1}`);
    editBtn.onclick = () => {
      if (row.querySelector('.sentence-editor')) return;
      stopPractice();
      const editor = document.createElement('form');
      editor.className = 'sentence-editor';
      const input = document.createElement('textarea');
      input.className = 'w-full';
      input.rows = 2;
      input.value = item.text;
      input.setAttribute('aria-label', `Sentence text ${idx + 1}`);
      const save = document.createElement('button');
      save.className = 'btn';
      save.textContent = 'Save';
      save.type = 'submit';
      const cancel = document.createElement('button');
      cancel.className = 'btn secondary';
      cancel.textContent = 'Cancel';
      cancel.type = 'button';
      cancel.onclick = () => { editor.remove(); textWrap.hidden = false; editBtn.focus(); };
      const errorMessage = document.createElement('div');
      errorMessage.className = 'sentence-edit-error';
      errorMessage.setAttribute('role', 'alert');
      editor.onsubmit = event => {
        event.preventDefault();
        return runAction(async () => {
          const id = window.currentListId;
          stopPractice();
          errorMessage.textContent = '';
          try {
            await lessonRequest('replaceSentence', {file: id, oldText: item.text, text: input.value});
          } catch (error) {
            errorMessage.textContent = error.message;
            throw error;
          }
          await loadLessons(id);
        });
      };
      editor.append(input, save, cancel, errorMessage);
      textWrap.hidden = true;
      textWrap.after(editor);
      input.focus();
    };
    icons.insertBefore(editBtn, delBtn);
    row.appendChild(textWrap);

    const meta = document.createElement('div');
    meta.className = 'meta';
    meta.innerHTML = `<span class="sentence-completion" aria-hidden="true"></span>Correct attempts: <strong>${item.correctCount || 0}</strong> <span style="margin-left:8px" class="small recognized">(No recording yet)</span>`;

    const controls = document.createElement('div');
    controls.className = 'sentence-controls';
    controls.appendChild(meta);
    controls.appendChild(icons);
    row.appendChild(controls);

    sentencesEl.appendChild(row);

    // Click word to speak it
    row.querySelectorAll('.word').forEach((w) => {
      w.addEventListener('click', () => {
        const raw = decodeURIComponent(w.dataset.word);
        speak(raw);
      });
    });
  });
  applySentenceFilter();
  updateCompletionIndicators();
}

function updateCompletionIndicators() {
  const sentences = window.lists[window.currentListId]?.sentences || [];
  for (const row of sentencesEl.querySelectorAll('.sentence-row')) {
    const completed = (sentences[row.dataset.sentenceIndex]?.correctCount || 0) > 0;
    const indicator = row.querySelector('.sentence-completion');
    indicator.textContent = completed ? '✓' : '';
    indicator.setAttribute('aria-hidden', String(!completed));
    if (completed) {
      indicator.setAttribute('role', 'img');
      indicator.setAttribute('aria-label', 'Completed at least once');
    } else {
      indicator.removeAttribute('role');
      indicator.removeAttribute('aria-label');
    }
  }
  for (const element of [...listsEl.children, ...selectList.options]) {
    const id = element.dataset.lessonId || element.value;
    const completed = completedLessons[id] === window.lists[id].revision;
    element.classList.toggle('lesson-completed', completed);
    if (completed) element.title = 'Completed: every sentence has at least one correct attempt.';
    else element.removeAttribute('title');
  }
}

runAction(async () => {
  await loadLessons(null, true);
  lessonSearch.disabled = false;
  await refreshAcceptedWords();
});
// Keyboard shortcuts for selected sentence row
document.addEventListener('keydown', (e) => {
  const activeEl = document.activeElement;
  if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA' || activeEl.tagName === 'SELECT')) {
    return;
  }

  if (window.selectedSentenceIdx !== null && window.selectedSentenceIdx !== undefined) {
    const rows = document.querySelectorAll('.sentence-row');
    const row = rows[window.selectedSentenceIdx];
    if (row) {
      if (e.key === '1') {
        const btn = row.querySelector('.replay-btn');
        if (btn) btn.click();
      } else if (e.key === '2') {
        const btn = row.querySelector('[title="Record and compare"]');
        if (btn) btn.click();
      } else if (e.key === '3') {
        const btn = row.querySelector('[title="Play sentence"]');
        if (btn) btn.click();
      }
    }
  }
});

async function refreshAcceptedWords() {
  const result = await acceptedWordsRequest();
  stopPractice();
  applyAcceptedWords(result);
  renderSentences();
}

const acceptedWordsStatus = document.getElementById('acceptedWordsStatus');
async function wordListAction(action) {
  acceptedWordsStatus.textContent = '';
  await runAction(async () => {
    try { await action(); }
    catch (error) { acceptedWordsStatus.textContent = error.message; throw error; }
  });
}

document.getElementById('lenientMode').addEventListener('change', event => {
  stopPractice();
  window.lenientMode = event.target.checked;
  document.getElementById('acceptedWordsEditor').hidden = !window.lenientMode;
  saveConfig({lenientMode: window.lenientMode}).catch(showSaveError);
  renderSentences();
});

document.getElementById('saveAcceptedWords').addEventListener('click', () => wordListAction(async () => {
  const result = await acceptedWordsRequest({text: document.getElementById('acceptedWords').value, revision: acceptedWordsRevision});
  stopPractice();
  applyAcceptedWords(result);
  renderSentences();
  acceptedWordsStatus.textContent = 'Accepted words saved.';
}));

document.getElementById('cancelAcceptedWords').addEventListener('click', () => {
  document.getElementById('acceptedWords').value = acceptedWordsText;
  document.getElementById('acceptedWordsEditor').open = false;
  acceptedWordsStatus.textContent = '';
});

document.getElementById('reloadAcceptedWords').addEventListener('click', () => wordListAction(async () => {
  if (document.getElementById('acceptedWords').value !== acceptedWordsText && !confirm('Discard unsaved edits and reload the word list?')) return;
  await refreshAcceptedWords();
  acceptedWordsStatus.textContent = 'Accepted words reloaded.';
}));
