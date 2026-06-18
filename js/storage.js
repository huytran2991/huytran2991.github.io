// Data model state
var lists = {}; // {listId: {name, sentences: [{text, correctCount}]}}
var currentListId = null;
var currentUser = null;

// Local storage keys
const LS_KEY = 'english_practice_data_v1';
const LS_CONFIG = 'english_practice_cfg_v1';
const LS_LAST_LIST = 'english_practice_last_list';

// ========== Helpers ==========
function normalizeText(t) {
  return (t || '').trim().toLowerCase().replace(/[.,!?;:()\"'`]/g, '').replace(/\s+/g, ' ');
}

function escapeHtml(s) {
  return (s + '').replace(/[&<>\"]/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;"
  }[c]));
}

// ========== Firestore operations ==========
async function loadListsFromFirestore() {
  if (!currentUser) return;
  try {
    const snap = await db.collection('users').doc(currentUser.uid).collection('lists').get();
    lists = {};
    snap.forEach((doc) => {
      lists[doc.id] = doc.data();
    });
    if (Object.keys(lists).length === 0) {
      const id = await createListFirestore('Default');
      lists[id].sentences = [];
    }
    
    if (typeof renderListsUI === 'function') {
      renderListsUI();
    }
    
    // Load last opened list after UI is rendered
    const lastListId = localStorage.getItem(LS_LAST_LIST);
    if (lastListId && lists[lastListId]) {
      if (typeof selectListById === 'function') selectListById(lastListId);
    } else {
      const keys = Object.keys(lists);
      if (keys.length > 0) {
        if (typeof selectListById === 'function') selectListById(keys[0]);
      }
    }
  } catch (e) {
    console.error(e);
    alert('Load lists error: ' + e.message);
  }
}

async function saveListToFirestore(listId) {
  if (!currentUser) return;
  try {
    await db.collection('users').doc(currentUser.uid).collection('lists').doc(listId).set(lists[listId]);
  } catch (e) {
    console.error(e);
  }
}

async function createListFirestore(name) {
  const docRef = db.collection('users').doc(currentUser.uid).collection('lists').doc();
  lists[docRef.id] = { name, sentences: [] };
  await docRef.set(lists[docRef.id]);
  
  if (typeof renderListsUI === 'function') {
    renderListsUI();
  }
  return docRef.id;
}

async function deleteListFirestore(listId) {
  if (!currentUser) return;
  await db.collection('users').doc(currentUser.uid).collection('lists').doc(listId).delete();
  delete lists[listId];
  if (currentListId === listId) currentListId = null;
  localStorage.removeItem(LS_LAST_LIST);
  
  if (typeof renderListsUI === 'function') {
    renderListsUI();
  }
}

async function renameList(listId) {
  const listName = lists[listId].name;
  const newName = prompt("Nhập tên mới cho danh sách:", listName);
  if (newName !== null && newName.trim() !== "" && newName.trim() !== listName) {
    lists[listId].name = newName.trim();
    if (currentUser) {
      await saveListToFirestore(listId);
    } else {
      saveListsToLocal();
    }
    if (typeof renderListsUI === 'function') {
      renderListsUI();
    }
  }
}

// ========== Local fallback ==========
function saveListsToLocal() {
  localStorage.setItem(LS_KEY, JSON.stringify(lists));
}

function loadListsFromLocal() {
  try {
    lists = JSON.parse(localStorage.getItem(LS_KEY) || '{}') || {};
    if (typeof renderListsUI === 'function') {
      renderListsUI();
    }
    const lastListId = localStorage.getItem(LS_LAST_LIST);
    if (lastListId && lists[lastListId]) {
      if (typeof selectListById === 'function') selectListById(lastListId);
    } else {
      const keys = Object.keys(lists);
      if (keys.length > 0) {
        if (typeof selectListById === 'function') selectListById(keys[0]);
      }
    }
  } catch (e) {
    lists = {};
  }
}

// ========== Config ==========
async function loadConfig() {
  if (!currentUser) return loadConfigLocal();
  try {
    const doc = await db.collection('users').doc(currentUser.uid).collection('meta').doc('config').get();
    if (doc.exists) {
      applyConfig(doc.data());
    } else {
      loadConfigLocal();
    }
  } catch (e) {
    console.error(e);
    loadConfigLocal();
  }
}

function loadConfigLocal() {
  try {
    const cfg = JSON.parse(localStorage.getItem(LS_CONFIG) || '{}');
    applyConfig(cfg);
  } catch (e) {}
}

function applyConfig(cfg) {
  if (!cfg) return;
  const voiceSelect = document.getElementById('voiceSelect');
  const rateEl = document.getElementById('rate');
  if (cfg.voice && voiceSelect) voiceSelect.value = cfg.voice;
  if (cfg.rate && rateEl) rateEl.value = cfg.rate;
}

async function saveConfig(cfg) {
  localStorage.setItem(LS_CONFIG, JSON.stringify(cfg));
  if (!currentUser) return;
  try {
    await db.collection('users').doc(currentUser.uid).collection('meta').doc('config').set(cfg);
  } catch (e) {
    console.error(e);
  }
}

// Expose states to global window scope to avoid issues
window.lists = lists;
window.currentListId = currentListId;
window.currentUser = currentUser;
