// =======================
// CONFIG: Thay bằng Firebase config của bạn
// =======================
const firebaseConfig = {
  apiKey: "AIzaSyBeA6AoCyF1WjvVJw2BWmtUYyOQ1VCpMJo",
  authDomain: "english-practice-e5ebd.firebaseapp.com",
  projectId: "english-practice-e5ebd",
  storageBucket: "english-practice-e5ebd.firebasestorage.app",
  messagingSenderId: "167826255253",
  appId: "1:167826255253:web:94e29c8123fb933eba1a9c",
  measurementId: "G-3MXHFZ1RPJ"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

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

// Data model
let lists = {}; // {listId: {name, sentences: [{text, correctCount}]}}
let currentListId = null;
let currentUser = null;

// Local storage keys
const LS_KEY = 'english_practice_data_v1';
const LS_CONFIG = 'english_practice_cfg_v1';
let isShowSidebar = 0;

// Sidebar toggle functionality
btnShowHideSidebar.addEventListener('click', ()=> {
  console.log('sss');
  const sidebar = document.querySelector('#sidebar');
  if( isShowSidebar ) {
    sidebar.style.left = '-320px';
    btnShowHideSidebar.style.left = '0px';
    isShowSidebar = 0;
  }
  else {
    sidebar.style.left = '0px';
    btnShowHideSidebar.style.left = '320px';
    isShowSidebar = 1;
  }
});

// ========== Auth ==========
btnSignIn.addEventListener('click', async () => {
  const provider = new firebase.auth.GoogleAuthProvider();
  try { await auth.signInWithPopup(provider); }
  catch(e){ alert('Sign-in error: '+e.message); }
});
btnSignOut.addEventListener('click', ()=>auth.signOut());

auth.onAuthStateChanged(async user => {
  currentUser = user;
  if(user){
    userInfo.textContent = user.displayName || user.email;
    btnSignIn.classList.add('hidden'); btnSignOut.classList.remove('hidden');
    await loadListsFromFirestore();
    await loadConfig();
  } else {
    userInfo.textContent = 'Not signed in';
    btnSignIn.classList.remove('hidden'); btnSignOut.classList.add('hidden');
    loadListsFromLocal();
    loadConfigLocal();
  }
});

// ========== Helpers ==========
function normalizeText(t){
  return (t||'').trim().toLowerCase().replace(/[.,!?;:()\"'`]/g,'').replace(/\s+/g,' ');
}
function escapeHtml(s){return (s+'').replace(/[&<>\"]/g,c=>({"&":"&","<":"<",">":">","\"":"""}[c]));}
}
)
)
}

// ========== Firestore operations ==========
async function loadListsFromFirestore(){
  if(!currentUser) return;
  try{
    const snap = await db.collection('users').doc(currentUser.uid).collection('lists').get();
    lists = {};
    snap.forEach(doc => {
      lists[doc.id] = doc.data();
    });
    if(Object.keys(lists).length===0){
      const id = await createListFirestore('Default');
      lists[id].sentences = [];
    }
    renderListsUI();
  }catch(e){console.error(e); alert('Load lists error: '+e.message);}
}
async function saveListToFirestore(listId){
  if(!currentUser) return;
  try{ await db.collection('users').doc(currentUser.uid).collection('lists').doc(listId).set(lists[listId]); }
  catch(e){console.error(e);}
}
async function createListFirestore(name){
  const docRef = db.collection('users').doc(currentUser.uid).collection('lists').doc();
  lists[docRef.id] = {name, sentences: []};
  await docRef.set(lists[docRef.id]);
  renderListsUI();
  return docRef.id;
}
async function deleteListFirestore(listId){
  if(!currentUser) return;
  await db.collection('users').doc(currentUser.uid).collection('lists').doc(listId).delete();
  delete lists[listId];
  if(currentListId === listId) currentListId = null;
  renderListsUI();
}

// ========== Local fallback ==========
function saveListsToLocal(){ localStorage.setItem(LS_KEY, JSON.stringify(lists)); }
function loadListsFromLocal(){ try{ lists = JSON.parse(localStorage.getItem(LS_KEY) || '{}') || {}; renderListsUI(); }catch(e){lists={};} }

// ========== Config ==========
async function loadConfig(){
  if(!currentUser) return loadConfigLocal();
  try{
    const doc = await db.collection('users').doc(currentUser.uid).collection('meta').doc('config').get();
    if(doc.exists){ applyConfig(doc.data()); } else loadConfigLocal();
  }catch(e){console.error(e); loadConfigLocal();}
}
function loadConfigLocal(){ try{ const cfg = JSON.parse(localStorage.getItem(LS_CONFIG)||'{}'); applyConfig(cfg); }catch(e){} }
function applyConfig(cfg){ if(!cfg) return; if(cfg.voice) voiceSelect.value = cfg.voice; if(cfg.rate) rateEl.value = cfg.rate; }
async function saveConfig(cfg){ localStorage.setItem(LS_CONFIG, JSON.stringify(cfg)); if(!currentUser) return; try{ await db.collection('users').doc(currentUser.uid).collection('meta').doc('config').set(cfg);}catch(e){console.error(e);} }

// ========== UI Rendering ==========
function renderListsUI(){
  // sidebar list
  listsEl.innerHTML = '';
  selectList.innerHTML = '';
  for(const id of Object.keys(lists)){
    const li = document.createElement('div'); li.className='list-item';
    const left = document.createElement('div'); left.innerHTML = `<strong>${escapeHtml(lists[id].name)}</strong><div class="small">${(lists[id].sentences||[]).length} câu</div>`;
    const right = document.createElement('div'); right.style.display='flex'; right.style.gap='6px';
    const openBtn = document.createElement('button'); openBtn.className='btn secondary'; openBtn.textContent='Mở'; openBtn.onclick=()=>selectListById(id);
    const delBtn = document.createElement('button'); delBtn.className='btn ghost'; delBtn.textContent='Xóa'; delBtn.onclick=async ()=>{ if(confirm('Xoá danh sách này?')){ if(currentUser) await deleteListFirestore(id); else { delete lists[id]; saveListsToLocal(); } if(currentListId===id) currentListId=null; renderListsUI(); } };
    right.appendChild(openBtn); right.appendChild(delBtn);
    li.appendChild(left); li.appendChild(right);
    listsEl.appendChild(li);

    const opt = document.createElement('option'); opt.value=id; opt.textContent=lists[id].name; selectList.appendChild(opt);
  }
  if(!currentListId){
    const keys = Object.keys(lists);
    if(keys.length) selectListById(keys[0]);
    else sentencesEl.innerHTML = '<div class="small">Chưa có danh sách. Tạo danh sách mới ở bên trái.</div>';
  } else {
    selectList.value = currentListId;
  }
}

function selectListById(id){
  currentListId = id;
  selectList.value = id;
  renderSentences();
}

btnCreateList.addEventListener('click', async ()=>{
  const name = newListName.value.trim(); if(!name) return alert('Nhập tên danh sách');
  if(currentUser) await createListFirestore(name); else { const id='local_'+Date.now(); lists[id]={name, sentences:[]}; saveListsToLocal(); renderListsUI(); }
  newListName.value='';
});

btnDeleteList.addEventListener('click', async ()=>{
  if(!currentListId) return alert('Chọn danh sách để xóa');
  if(!confirm('Xoá danh sách hiện tại?')) return;
  if(currentUser){ await deleteListFirestore(currentListId); } else { delete lists[currentListId]; saveListsToLocal(); currentListId=null; renderListsUI(); }
});

selectList.addEventListener('change', ()=>selectListById(selectList.value));

btnLoadDemo.addEventListener('click', ()=>{ inputSentences.value = ['This is a cat.','I like apples.','She is reading a book.','Do you speak English?','They went to the market.'].join('\n'); });

// Add sentences
btnAddSentences.addEventListener('click', async ()=>{
  const raw = inputSentences.value.trim(); if(!raw) return;
  const lines = raw.split(/\r?\n/).map(s=>s.trim()).filter(Boolean);
  if(!currentListId){
    if(currentUser) currentListId = (await createListFirestore('New list')).toString();
    else { currentListId = 'local_'+Date.now(); lists[currentListId] = {name:'New list', sentences:[]}; }
  }
  for(const line of lines){
    lists[currentListId].sentences = lists[currentListId].sentences || [];
    lists[currentListId].sentences.push({text: line, correctCount: 0});
  }
  if(currentUser) await saveListToFirestore(currentListId); else saveListsToLocal();
  inputSentences.value=''; renderSentences(); renderListsUI();
});

btnClearSentences.addEventListener('click', ()=>{ inputSentences.value=''; });

btnImport.addEventListener('click', ()=>{ const text = prompt('Paste danh sách câu (mỗi dòng 1 câu)'); if(text) inputSentences.value=text; });
btnExport.addEventListener('click', ()=>{
  if(!currentListId) return alert('Chọn danh sách để export');
  const arr = lists[currentListId].sentences||[];
  const out = arr.map(s=>s.text).join('\n');
  const blob = new Blob([out],{type:'text/plain'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href=url; a.download=(lists[currentListId].name||'sentences')+'.txt'; a.click(); URL.revokeObjectURL(url);
});

// Render sentences with buttons and features (including delete)
function renderSentences(){
  sentencesEl.innerHTML=''; 
  if(!currentListId || !lists[currentListId]) return sentencesEl.innerHTML='<div class="small">Chọn hoặc tạo danh sách để bắt đầu</div>';
  const arr = lists[currentListId].sentences || [];
  arr.forEach((item, idx)=>{
    const row = document.createElement('div'); row.className='sentence-row';
    const top = document.createElement('div'); top.className='sentence-top';
    const textWrap = document.createElement('div'); textWrap.className='sentence-text';
    textWrap.innerHTML = item.text.split(/(\s+)/).map(tok=>{
      if(tok.trim()==='') return tok;
      return `<span class="word" data-word="${encodeURIComponent(tok)}">${escapeHtml(tok)}</span>`;
    }).join('');
    const icons = document.createElement('div'); icons.className='icons';
    const playBtn = document.createElement('button'); playBtn.className='icon-btn'; playBtn.title='Play sentence'; playBtn.innerHTML='🔊'; playBtn.onclick=()=>speak(item.text);
    const micBtn = document.createElement('button'); micBtn.className='icon-btn'; micBtn.title='Record and compare'; micBtn.innerHTML='🎤'; micBtn.onclick=()=>startRecognition(item, row, idx);
    const resetBtn = document.createElement('button'); resetBtn.className='icon-btn'; resetBtn.title='Reset count'; resetBtn.innerHTML='↺'; resetBtn.onclick=async ()=>{ if(confirm('Reset số lần đúng về 0?')){ item.correctCount=0; if(currentUser) await saveListToFirestore(currentListId); else saveListsToLocal(); renderSentences(); } };
    const delBtn = document.createElement('button'); delBtn.className='icon-btn'; delBtn.title='Delete sentence'; delBtn.innerHTML='🗑️'; delBtn.onclick=async ()=>{
      if(!confirm('Bạn có chắc muốn xoá câu này?')) return;
      lists[currentListId].sentences.splice(idx,1);
      if(currentUser) await saveListToFirestore(currentListId); else saveListsToLocal();
      renderSentences(); renderListsUI();
    };

    icons.appendChild(playBtn); icons.appendChild(micBtn); icons.appendChild(resetBtn); icons.appendChild(delBtn);
    top.appendChild(textWrap); top.appendChild(icons);
    row.appendChild(top);

    const meta = document.createElement('div'); meta.className='meta';
    meta.innerHTML = `Đúng toàn câu: <strong>${item.correctCount||0}</strong> <span style="margin-left:8px" class="small recognized">(Bạn chưa nói)</span>`;
    row.appendChild(meta);

    sentencesEl.appendChild(row);

    // per-word click to speak
    row.querySelectorAll('.word').forEach(w=>{
      w.addEventListener('click', ()=>{ const raw = decodeURIComponent(w.dataset.word); speak(raw); });
    });
  });
}

// ========== Speech Synthesis (TTS) ==========
let voices = [];
function populateVoices(){
  voices = speechSynthesis.getVoices();
  voiceSelect.innerHTML = '';
  voices.forEach((v,i)=>{
    const label = `${v.name} (${v.lang})`;
    const opt = document.createElement('option'); opt.value = i; opt.textContent = label; voiceSelect.appendChild(opt);
  });
  // restore cfg if present
  const cfg = JSON.parse(localStorage.getItem(LS_CONFIG)||'{}'); if(cfg.voice) voiceSelect.value = cfg.voice;
}
populateVoices();
if(typeof speechSynthesis !== 'undefined') speechSynthesis.onvoiceschanged = populateVoices;

function speak(text){
  if(!('speechSynthesis' in window)) return alert('Trình duyệt không hỗ trợ speechSynthesis');
  const u = new SpeechSynthesisUtterance(text);
  const idx = parseInt(voiceSelect.value||0,10);
  if(voices[idx]) u.voice = voices[idx];
  u.rate = parseFloat(rateEl.value||1);
  speechSynthesis.cancel();
  speechSynthesis.speak(u);
  // save config
  saveConfig({voice: voiceSelect.value, rate: rateEl.value});
}
btnTestVoice.addEventListener('click', ()=>speak('This is a test. Hello!'));

// ========== Speech Recognition (ASR) and comparison ==========
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition || null;
function startRecognition(item, row, idx){
  if(!SpeechRecognition) return alert('Trình duyệt không hỗ trợ SpeechRecognition (ASR). Dùng Chrome trên desktop để có trải nghiệm tốt nhất).');
  const recogDiv = row.querySelector('.recognized');
  const wordEls = row.querySelectorAll('.word');

  const rec = new SpeechRecognition();
  rec.lang = 'en-US';
  rec.interimResults = false;
  rec.maxAlternatives = 1;
  recogDiv.textContent = 'Listening...';
  rec.start();

  rec.onresult = async (e)=>{
    const transcript = e.results[0][0].transcript;
    recogDiv.textContent = transcript;
    highlightComparison(item.text, transcript, wordEls);

    const normExp = normalizeText(item.text);
    const normRec = normalizeText(transcript);
    if(normExp === normRec){
      item.correctCount = (item.correctCount||0) + 1;
      if(currentUser) await saveListToFirestore(currentListId); else saveListsToLocal();
      row.querySelector('.meta strong').textContent = item.correctCount;
    }
  };
  rec.onerror = (err)=>{ recogDiv.textContent = 'Error: '+(err.error || err.message || 'unknown'); };
  rec.onend = ()=>{ /* do nothing */ };
}

// naive comparison & highlight
function highlightComparison(expectedText, recognizedText, wordElements){
  const expWords = expectedText.split(/\s+/).map(w=>normalizeText(w)).filter(Boolean);
  const recWords = recognizedText.split(/\s+/).map(w=>normalizeText(w)).filter(Boolean);
  // Try align by index, but also mark correct if present anywhere
  wordElements.forEach((el, i)=>{
    const w = normalizeText(decodeURIComponent(el.dataset.word));
    let isCorrect = false;
    if(recWords[i] && recWords[i] === w) isCorrect = true;
    else if(recWords.includes(w)) isCorrect = true;
    if(isCorrect){ el.classList.add('correct'); el.classList.remove('wrong'); }
    else { el.classList.add('wrong'); el.classList.remove('correct'); }
  });
}

// ========== Save on leave ==========
window.addEventListener('beforeunload', ()=>{ if(!currentUser) saveListsToLocal(); saveConfig({voice: voiceSelect.value, rate: rateEl.value}); });

// ========== Init: load local lists (if any) ==========
function loadListsFromLocal(){ try{ lists = JSON.parse(localStorage.getItem(LS_KEY) || '{}') || {}; renderListsUI(); }catch(e){ lists = {}; } }
loadListsFromLocal();

// ========== Config save ==========
function saveConfigLocal(cfg){ localStorage.setItem(LS_CONFIG, JSON.stringify(cfg)); }
function loadConfigLocal(){ try{ const cfg = JSON.parse(localStorage.getItem(LS_CONFIG)||'{}'); applyConfig(cfg);}catch(e){} }
loadConfigLocal();

// Expose some functions for console/testing
window.speak = speak;
window.renderListsUI = renderListsUI;
window.renderSentences = renderSentences;