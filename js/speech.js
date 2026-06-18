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

window.lastRecordedAudios = {};

function playSuccessSound() {
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!AudioContext) return;
  const ctx = new AudioContext();
  const now = ctx.currentTime;
  
  const osc1 = ctx.createOscillator();
  const gain1 = ctx.createGain();
  osc1.type = 'sine';
  osc1.frequency.setValueAtTime(523.25, now); // C5
  gain1.gain.setValueAtTime(0.1, now);
  gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
  osc1.connect(gain1);
  gain1.connect(ctx.destination);
  osc1.start(now);
  osc1.stop(now + 0.15);
  
  const osc2 = ctx.createOscillator();
  const gain2 = ctx.createGain();
  osc2.type = 'sine';
  osc2.frequency.setValueAtTime(659.25, now + 0.08); // E5
  gain2.gain.setValueAtTime(0.1, now + 0.08);
  gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
  osc2.connect(gain2);
  gain2.connect(ctx.destination);
  osc2.start(now + 0.08);
  osc2.stop(now + 0.25);
}

function playErrorSound() {
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!AudioContext) return;
  const ctx = new AudioContext();
  const now = ctx.currentTime;
  
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'triangle'; // triangle is softer than sawtooth/square but more buzz-like than sine
  osc.frequency.setValueAtTime(180, now); // Low pitch
  osc.frequency.linearRampToValueAtTime(120, now + 0.25); // Slide down
  
  gain.gain.setValueAtTime(0.12, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
  
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(now);
  osc.stop(now + 0.25);
}

const MIC_ICON = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-mic"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"></path><path d="M19 10v1a7 7 0 0 1-14 0v-1"></path><line x1="12" x2="12" y1="19" y2="22"></line></svg>`;
const STOP_ICON = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-square"><rect width="18" height="18" x="3" y="3" rx="2"></rect></svg>`;

window.activeRecognition = null;

function playRecordedAudio(idx) {
  const audioUrl = window.lastRecordedAudios[idx];
  if (!audioUrl) return;
  const audio = new Audio(audioUrl);
  audio.play().catch(err => console.error("Error playing recorded audio:", err));
}

function startRecognition(item, row, idx) {
  if (window.isSecureContext === false) {
    return alert('SpeechRecognition và Microphone yêu cầu kết nối bảo mật (HTTPS) để hoạt động trên thiết bị di động. Vui lòng sử dụng HTTPS hoặc truy cập qua localhost.');
  }

  if (!SpeechRecognition) return alert('Trình duyệt không hỗ trợ SpeechRecognition (ASR). Dùng Chrome trên desktop để có trải nghiệm tốt nhất.');
  
  const recogDiv = row.querySelector('.recognized');
  const wordEls = row.querySelectorAll('.word');
  const micBtn = row.querySelector('[title="Record and compare"]');

  // Handle active recognition toggling
  if (window.activeRecognition) {
    const isSame = window.activeRecognition.idx === idx;
    const oldRec = window.activeRecognition.rec;
    
    // Stop the running recognition
    if (oldRec) {
      oldRec.stop();
    }
    window.activeRecognition = null;
    
    if (isSame) {
      return; // Just stop the current recording
    }
  }

  // Reset word colors to initial state
  wordEls.forEach(el => {
    el.classList.remove('correct', 'wrong');
  });

  // Visually enter recording state
  if (micBtn) {
    micBtn.classList.add('recording');
    micBtn.innerHTML = STOP_ICON;
  }

  window.activeRecognition = {
    rec: null,
    idx: idx,
    micBtn: micBtn
  };

  // Helper to detect mobile device (Android, iOS) to avoid getUserMedia conflict
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || 
                   (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

  // Core recognition setup function
  const runRecognition = (stream = null) => {
    const rec = new SpeechRecognition();
    rec.lang = 'en-US';
    rec.interimResults = true;
    rec.continuous = !isMobile;
    rec.maxAlternatives = 1;
    recogDiv.textContent = 'Listening...';
    let hasProcessed = false;

    window.activeRecognition.rec = rec;

    let mediaRecorder = null;
    let chunks = [];

    if (stream) {
      mediaRecorder = new MediaRecorder(stream);
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunks.push(e.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'audio/webm' });
        if (window.lastRecordedAudios[idx]) {
          URL.revokeObjectURL(window.lastRecordedAudios[idx]);
        }
        window.lastRecordedAudios[idx] = URL.createObjectURL(blob);
        
        const replayBtn = row.querySelector('.replay-btn');
        if (replayBtn) {
          replayBtn.classList.remove('invisible');
        }

        stream.getTracks().forEach(track => track.stop());
      };
    }

    rec.onstart = () => {
      if (mediaRecorder) {
        mediaRecorder.start();
      }
    };

    rec.onresult = async (e) => {
      let finalTranscript = '';
      let interimTranscript = '';

      for (let i = e.resultIndex; i < e.results.length; ++i) {
        if (e.results[i].isFinal) {
          finalTranscript += e.results[i][0].transcript + ' ';
        } else {
          interimTranscript += e.results[i][0].transcript;
        }
      }

      const transcript = (finalTranscript + interimTranscript).trim();
      if (!transcript) return;

      recogDiv.textContent = transcript;
      highlightComparison(item.text, transcript, wordEls);

      const normExp = normalizeText(item.text);
      const normRec = normalizeText(transcript);
      
      if (normExp === normRec && !hasProcessed) {
        hasProcessed = true;
        item.correctCount = (item.correctCount || 0) + 1;
        
        playSuccessSound();

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
        
        rec.stop();
      }
    };
    
    rec.onerror = (err) => {
      console.error('Speech recognition error:', err);
      recogDiv.textContent = 'Error: ' + (err.error || err.message || 'unknown');
      if (mediaRecorder && mediaRecorder.state !== 'inactive') {
        mediaRecorder.stop();
      }
    };

    rec.onend = () => {
      if (mediaRecorder && mediaRecorder.state !== 'inactive') {
        mediaRecorder.stop();
      }

      if (!hasProcessed) {
        hasProcessed = true;
        playErrorSound();
      }

      if (micBtn) {
        micBtn.classList.remove('recording');
        micBtn.innerHTML = MIC_ICON;
      }

      if (window.activeRecognition && window.activeRecognition.rec === rec) {
        window.activeRecognition = null;
      }
    };

    rec.start();
  };

  if (isMobile) {
    // Hide replay button on mobile since we don't record audio to prevent resource locks
    const replayBtn = row.querySelector('.replay-btn');
    if (replayBtn) {
      replayBtn.classList.add('invisible');
    }
    runRecognition();
  } else {
    navigator.mediaDevices.getUserMedia({ audio: true })
      .then(stream => {
        // Check if user cancelled while we were waiting for mic permission
        if (!window.activeRecognition || window.activeRecognition.idx !== idx) {
          stream.getTracks().forEach(track => track.stop());
          return;
        }
        runRecognition(stream);
      })
      .catch(err => {
        console.error('Error accessing microphone:', err);
        alert('Không thể truy cập microphone. Vui lòng cấp quyền truy cập micro.');
        if (micBtn) {
          micBtn.classList.remove('recording');
          micBtn.innerHTML = MIC_ICON;
        }
        window.activeRecognition = null;
      });
  }
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
