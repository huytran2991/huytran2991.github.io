// ========== Speech Synthesis (TTS) ==========
let voices = [];

function populateVoices() {
  const voiceSelect = document.getElementById('voiceSelect');
  if (!voiceSelect) return;
  
  // Filter for English voices only
  voices = speechSynthesis.getVoices().filter(voice => voice.lang.startsWith('en'));
  voiceSelect.innerHTML = '';
  
  voices.forEach((v, i) => {
    const label = `${v.name} (${v.lang})`;
    const opt = document.createElement('option');
    opt.value = v.name;
    opt.textContent = label;
    voiceSelect.appendChild(opt);
  });
  
  // Restore config if available
  try {
    const cfg = JSON.parse(localStorage.getItem('english_practice_cfg_v1') || '{}');
    if (cfg.voice) {
      voiceSelect.value = cfg.voice;
    } else if (voiceSelect.options.length > 0) {
      voiceSelect.value = voiceSelect.options[0].value;
    }
  } catch (e) {
    console.error('Failed to restore voice config:', e);
  }
}

// Initialize voices list
if (typeof speechSynthesis !== 'undefined') {
  if (speechSynthesis.onvoiceschanged !== undefined) {
    speechSynthesis.onvoiceschanged = populateVoices;
  }
  populateVoices();
}

function speak(text) {
  if (!('speechSynthesis' in window)) return alert('Trình duyệt không hỗ trợ speechSynthesis');
  const voiceSelect = document.getElementById('voiceSelect');
  const rateEl = document.getElementById('rate');
  
  const u = new SpeechSynthesisUtterance(text);
  const selectedVoice = voices.find(v => v.name === voiceSelect.value);
  if (selectedVoice) u.voice = selectedVoice;
  u.rate = parseFloat(rateEl.value || 1);
  
  speechSynthesis.cancel();
  speechSynthesis.speak(u);
  
  // Save voice settings to config
  if (typeof saveConfig === 'function') {
    saveConfig({ voice: voiceSelect.value, rate: rateEl.value });
  }
}

// ========== Speech Recognition (ASR) and comparison ==========
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition || null;

function startRecognition(item, row, idx) {
  if (!SpeechRecognition) return alert('Trình duyệt không hỗ trợ SpeechRecognition (ASR). Dùng Chrome trên desktop để có trải nghiệm tốt nhất.');
  
  const recogDiv = row.querySelector('.recognized');
  const wordEls = row.querySelectorAll('.word');

  const rec = new SpeechRecognition();
  rec.lang = 'en-US';
  rec.interimResults = false;
  rec.maxAlternatives = 1;
  recogDiv.textContent = 'Listening...';
  rec.start();

  rec.onresult = async (e) => {
    const transcript = e.results[0][0].transcript;
    recogDiv.textContent = transcript;
    highlightComparison(item.text, transcript, wordEls);

    const normExp = normalizeText(item.text);
    const normRec = normalizeText(transcript);
    
    if (normExp === normRec) {
      item.correctCount = (item.correctCount || 0) + 1;
      
      if (currentUser) {
        if (typeof saveListToFirestore === 'function') {
          await saveListToFirestore(currentListId);
        }
      } else {
        if (typeof saveListsToLocal === 'function') {
          saveListsToLocal();
        }
      }
      
      const scoreEl = row.querySelector('.meta strong');
      if (scoreEl) scoreEl.textContent = item.correctCount;
    }
  };
  
  rec.onerror = (err) => {
    recogDiv.textContent = 'Error: ' + (err.error || err.message || 'unknown');
  };
}

// Naive comparison & highlight
function highlightComparison(expectedText, recognizedText, wordElements) {
  const expWords = expectedText.split(/\s+/).map(w => normalizeText(w)).filter(Boolean);
  const recWords = recognizedText.split(/\s+/).map(w => normalizeText(w)).filter(Boolean);
  
  wordElements.forEach((el, i) => {
    const w = normalizeText(decodeURIComponent(el.dataset.word));
    let isCorrect = false;
    
    if (recWords[i] && recWords[i] === w) {
      isCorrect = true;
    } else if (recWords.includes(w)) {
      isCorrect = true;
    }
    
    if (isCorrect) {
      el.classList.add('correct');
      el.classList.remove('wrong');
    } else {
      el.classList.add('wrong');
      el.classList.remove('correct');
    }
  });
}
