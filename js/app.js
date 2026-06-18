window.selectedSentenceIdx = null;

// UI elements
const btnSignIn = document.getElementById('btnSignIn');
const btnSignOut = document.getElementById('btnSignOut');
const userInfo = document.getElementById('userInfo');
const listsEl = document.getElementById('lists');
const selectList = document.getElementById('selectList');
const newListName = document.getElementById('newListName');
const btnCreateList = document.getElementById('btnCreateList');
const btnDeleteList = document.getElementById('btnDeleteList');
const btnImport = document.getElementById('btnImport');
const btnExport = document.getElementById('btnExport');
const inputSentences = document.getElementById('inputSentences');
const btnAddSentences = document.getElementById('btnAddSentences');
const btnClearSentences = document.getElementById('btnClearSentences');
const sentencesEl = document.getElementById('sentences');
const voiceSelect = document.getElementById('voiceSelect');
const rateEl = document.getElementById('rate');
const btnTestVoice = document.getElementById('btnTestVoice');
const btnLoadDemo = document.getElementById('btnLoadDemo');
const btnShowHideSidebar = document.getElementById('btnShowHideSidebar');

// Sidebar toggle
btnShowHideSidebar.addEventListener('click', () => {
  const sidebar = document.querySelector('#sidebar');
  sidebar.classList.toggle('active');
  if (sidebar.classList.contains('active')) {
    btnShowHideSidebar.style.left = '320px';
    btnShowHideSidebar.textContent = '‹';
  } else {
    btnShowHideSidebar.style.left = '';
    btnShowHideSidebar.textContent = '›';
  }
});

// ========== Auth ==========
btnSignIn.addEventListener('click', async () => {
  const provider = new firebase.auth.GoogleAuthProvider();
  try {
    await auth.signInWithPopup(provider);
  } catch (e) {
    alert('Sign-in error: ' + e.message);
  }
});

btnSignOut.addEventListener('click', () => auth.signOut());

auth.onAuthStateChanged(async (user) => {
  window.currentUser = user;
  currentUser = user;
  if (user) {
    userInfo.textContent = user.displayName || user.email;
    btnSignIn.classList.add('hidden');
    btnSignOut.classList.remove('hidden');
    await loadListsFromFirestore();
    await loadConfig();
  } else {
    userInfo.textContent = 'Not signed in';
    btnSignIn.classList.remove('hidden');
    btnSignOut.classList.add('hidden');
    loadListsFromLocal();
    loadConfigLocal();
  }
});

// ========== UI Rendering ==========
function renderListsUI() {
  listsEl.innerHTML = '';
  selectList.innerHTML = '';
  const keys = Object.keys(window.lists || {});
  
  if (keys.length === 0) {
    sentencesEl.innerHTML = '<div class="small">Chưa có danh sách. Tạo danh sách mới ở bên trái.</div>';
  }

  for (const id of keys) {
    const li = document.createElement('div');
    li.className = 'list-item';
    
    const left = document.createElement('div');
    left.innerHTML = `<strong>${escapeHtml(window.lists[id].name)}</strong><div class="small">${(window.lists[id].sentences || []).length} câu</div>`;
    
    const right = document.createElement('div');
    right.className = 'list-item-actions';

    const openBtn = document.createElement('button');
    openBtn.className = 'btn secondary';
    openBtn.textContent = 'Mở';
    openBtn.onclick = () => selectListById(id);

    const editBtn = document.createElement('button');
    editBtn.className = 'btn ghost';
    editBtn.textContent = 'Sửa';
    editBtn.onclick = () => renameList(id);

    const delBtn = document.createElement('button');
    delBtn.className = 'btn ghost';
    delBtn.textContent = 'Xóa';
    delBtn.onclick = async () => {
      if (confirm('Xoá danh sách này?')) {
        if (window.currentUser) {
          await deleteListFirestore(id);
        } else {
          delete window.lists[id];
          saveListsToLocal();
        }
        if (window.currentListId === id) window.currentListId = null;
        renderListsUI();
      }
    };

    right.appendChild(openBtn);
    right.appendChild(editBtn);
    right.appendChild(delBtn);

    li.appendChild(left);
    li.appendChild(right);
    listsEl.appendChild(li);

    const opt = document.createElement('option');
    opt.value = id;
    opt.textContent = window.lists[id].name;
    selectList.appendChild(opt);
  }

  if (window.currentListId && !window.lists[window.currentListId]) {
    window.currentListId = null;
    localStorage.removeItem('english_practice_last_list');
  }

  if (window.currentListId) {
    selectList.value = window.currentListId;
    renderSentences();
  }
}

function selectListById(id) {
  window.currentListId = id;
  selectList.value = id;
  localStorage.setItem('english_practice_last_list', id);
  window.selectedSentenceIdx = null;
  renderSentences();
}

btnCreateList.addEventListener('click', async () => {
  const name = newListName.value.trim();
  if (!name) return alert('Nhập tên danh sách');
  if (window.currentUser) {
    await createListFirestore(name);
  } else {
    const id = 'local_' + Date.now();
    window.lists[id] = { name, sentences: [] };
    saveListsToLocal();
  }
  newListName.value = '';
  renderListsUI();
  const newId = Object.keys(window.lists).find((key) => window.lists[key].name === name);
  if (newId) selectListById(newId);
});

btnDeleteList.addEventListener('click', async () => {
  if (!window.currentListId) return alert('Chọn danh sách để xóa');
  if (!confirm('Xoá danh sách hiện tại?')) return;
  if (window.currentUser) {
    await deleteListFirestore(window.currentListId);
  } else {
    delete window.lists[window.currentListId];
    saveListsToLocal();
    window.currentListId = null;
    renderListsUI();
  }
});

selectList.addEventListener('change', () => selectListById(selectList.value));

btnLoadDemo.addEventListener('click', () => {
  inputSentences.value = [
    'This is a cat.',
    'I like apples.',
    'She is reading a book.',
    'Do you speak English?',
    'They went to the market.'
  ].join('\n');
});

btnAddSentences.addEventListener('click', async () => {
  const raw = inputSentences.value.trim();
  if (!raw) return;
  const lines = raw.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
  if (!window.currentListId) {
    if (window.currentUser) {
      window.currentListId = (await createListFirestore('New list')).toString();
    } else {
      window.currentListId = 'local_' + Date.now();
      window.lists[window.currentListId] = { name: 'New list', sentences: [] };
    }
  }
  for (const line of lines) {
    window.lists[window.currentListId].sentences = window.lists[window.currentListId].sentences || [];
    window.lists[window.currentListId].sentences.push({ text: line, correctCount: 0 });
  }
  if (window.currentUser) {
    await saveListToFirestore(window.currentListId);
  } else {
    saveListsToLocal();
  }
  inputSentences.value = '';
  renderSentences();
  renderListsUI();
});

btnClearSentences.addEventListener('click', () => {
  inputSentences.value = '';
});

btnImport.addEventListener('click', () => {
  const text = prompt('Paste danh sách câu (mỗi dòng 1 câu)');
  if (text) inputSentences.value = text;
});

btnExport.addEventListener('click', () => {
  if (!window.currentListId) return alert('Chọn danh sách để export');
  const arr = window.lists[window.currentListId].sentences || [];
  const out = arr.map((s) => s.text).join('\n');
  const blob = new Blob([out], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = (window.lists[window.currentListId].name || 'sentences') + '.txt';
  a.click();
  URL.revokeObjectURL(url);
});

// Render sentences
function renderSentences() {
  sentencesEl.innerHTML = '';
  if (!window.currentListId || !window.lists[window.currentListId]) {
    return sentencesEl.innerHTML = '<div class="small">Chọn hoặc tạo danh sách để bắt đầu</div>';
  }
  
  const arr = window.lists[window.currentListId].sentences || [];
  arr.forEach((item, idx) => {
    const row = document.createElement('div');
    row.className = 'sentence-row';
    if (window.selectedSentenceIdx === idx) {
      row.className += ' selected-row';
    }
    row.onclick = () => {
      window.selectedSentenceIdx = idx;
      document.querySelectorAll('.sentence-row').forEach(r => r.classList.remove('selected-row'));
      row.classList.add('selected-row');
    };
    
    const top = document.createElement('div');
    top.className = 'sentence-top';
    
    const textWrap = document.createElement('div');
    textWrap.className = 'sentence-text';
    textWrap.innerHTML = item.text.split(/(\s+)/).map((tok) => {
      if (tok.trim() === '') return tok;
      return `<span class="word" data-word="${encodeURIComponent(tok)}">${escapeHtml(tok)}</span>`;
    }).join('');
    
    const icons = document.createElement('div');
    icons.className = 'icons';
    
    const playBtn = document.createElement('button');
    playBtn.className = 'icon-btn';
    playBtn.title = 'Play sentence';
    playBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-volume-2"><path d="M11 5L6 9H2v6h4l5 4V5z"></path><path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path><path d="M19.07 4.93a10 10 0 0 1 0 14.14"></path></svg>`;
    playBtn.onclick = () => speak(item.text);
    
    const micBtn = document.createElement('button');
    micBtn.className = 'icon-btn';
    micBtn.title = 'Record and compare';
    micBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-mic"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"></path><path d="M19 10v1a7 7 0 0 1-14 0v-1"></path><line x1="12" x2="12" y1="19" y2="22"></line></svg>`;
    micBtn.onclick = () => startRecognition(item, row, idx);

    const replayBtn = document.createElement('button');
    replayBtn.className = `icon-btn replay-btn ${window.lastRecordedAudios && window.lastRecordedAudios[idx] ? '' : 'invisible'}`;
    replayBtn.title = 'Nghe lại giọng nói của bạn';
    replayBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-play-circle"><circle cx="12" cy="12" r="10"></circle><polygon points="10 8 16 12 10 16 10 8"></polygon></svg>`;
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
      if (confirm('Reset số lần đúng về 0?')) {
        item.correctCount = 0;
        if (window.currentUser) {
          await saveListToFirestore(window.currentListId);
        } else {
          saveListsToLocal();
        }
        renderSentences();
      }
    };
    
    const delBtn = document.createElement('button');
    delBtn.className = 'icon-btn';
    delBtn.title = 'Delete sentence';
    delBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-trash-2"><path d="M3 6h18"></path><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path><line x1="10" x2="10" y1="11" y2="17"></line><line x1="14" x2="14" y1="11" y2="17"></line></svg>`;
    delBtn.onclick = async () => {
      if (!confirm('Bạn có chắc muốn xoá câu này?')) return;
      window.lists[window.currentListId].sentences.splice(idx, 1);
      if (window.currentUser) {
        await saveListToFirestore(window.currentListId);
      } else {
        saveListsToLocal();
      }
      renderSentences();
      renderListsUI();
    };
 
    icons.appendChild(replayBtn);
    icons.appendChild(micBtn);
    icons.appendChild(playBtn);
    icons.appendChild(resetBtn);
    icons.appendChild(delBtn);
    
    top.appendChild(textWrap);
    top.appendChild(icons);
    row.appendChild(top);

    const meta = document.createElement('div');
    meta.className = 'meta';
    meta.innerHTML = `Đúng toàn câu: <strong>${item.correctCount || 0}</strong> <span style="margin-left:8px" class="small recognized">(Bạn chưa nói)</span>`;
    row.appendChild(meta);

    sentencesEl.appendChild(row);

    // Click word to speak it
    row.querySelectorAll('.word').forEach((w) => {
      w.addEventListener('click', () => {
        const raw = decodeURIComponent(w.dataset.word);
        speak(raw);
      });
    });
  });
}

// ========== Save on leave ==========
window.addEventListener('beforeunload', () => {
  if (!window.currentUser) saveListsToLocal();
  if (voiceSelect && rateEl) {
    saveConfig({ voice: voiceSelect.value, rate: rateEl.value });
  }
});

// Expose variables and functions for access by speech.js and storage.js
window.renderListsUI = renderListsUI;
window.renderSentences = renderSentences;
window.selectListById = selectListById;

// Load initial lists and configurations
loadListsFromLocal();
loadConfigLocal();

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
