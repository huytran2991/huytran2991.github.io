'use strict';
const $ = id => document.getElementById(id);
let config = null;
let loading = false;
let current = null;
let currentUrl = null;
let recorder = null;
let microphonePending = false;
let captureVersion = 0;
let recording = false;
let timer = null;
let request = null;
let requestVersion = 0;
let attempt = 0;
let history = [];
const MAX_BYTES = 8 * 1024 * 1024;

function message(text, error = false) {
  $('status').textContent = text;
  $('status').classList.toggle('error', error);
}

function updateControls() {
  const locked = recording || microphonePending || !!request;
  $('record').disabled = locked;
  $('stop').disabled = !recording;
  $('audio-file').disabled = locked;
  $('send').disabled = locked || loading || !current || !config?.available || !$('prompt').value;
  $('prompt').disabled = locked || loading || !config?.prompts.length;
  $('model').disabled = locked || loading || !config;
  $('reload').disabled = locked || loading;
  $('cancel').hidden = !request;
  $('clear').disabled = !history.length;
  $('record').textContent = current ? 'Record another attempt' : 'Start recording';
  $('dot').classList.toggle('live', recording);
}

function showPrompt() {
  const prompt = config?.prompts.find(item => item.id === $('prompt').value);
  $('prompt-preview').textContent = prompt?.text || '';
}

async function loadConfig() {
  if (loading || request || recording || microphonePending) return;
  loading = true;
  updateControls();
  const oldPrompt = $('prompt').value;
  const oldModel = $('model').value;
  $('config-status').textContent = 'Loading review settings…';
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await englishPracticeFetch('config', { cache: 'no-store', signal: controller.signal });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Cannot load review settings.');
    config = data;
    $('prompt').replaceChildren(...data.prompts.map(item => new Option(item.title, item.id)));
    $('model').replaceChildren(...Object.entries(data.models).map(([id, title]) => new Option(title, id)));
    if (data.prompts.some(item => item.id === oldPrompt)) $('prompt').value = oldPrompt;
    if (Object.hasOwn(data.models, oldModel)) $('model').value = oldModel;
    showPrompt();
    $('config-status').textContent = !data.prompts.length ? 'No prompts found in Firestore.'
      : data.available ? 'AI is ready. Feedback will be in Vietnamese.'
        : 'Enter your Gemini API key in Gemini settings to enable reviews.';
  } catch (error) {
    config = null;
    $('config-status').textContent = error.name === 'AbortError' ? 'Settings timed out. Try Reload prompts.' : error.message;
  } finally {
    clearTimeout(timeout);
    loading = false;
    updateControls();
  }
}

function setAudio(blob, name) {
  if (currentUrl) URL.revokeObjectURL(currentUrl);
  current = { blob, name };
  currentUrl = URL.createObjectURL(blob);
  $('audio').src = currentUrl;
  $('download').href = currentUrl;
  $('download').download = name;
  $('audio-name').textContent = `${name} · ${(blob.size / 1024).toFixed(0)} KB`;
  $('preview').hidden = false;
  $('record-label').textContent = 'Audio ready';
  updateControls();
}

async function startRecording() {
  if (recording || microphonePending || request) return;
  if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
    message('Microphone recording needs a supported browser and HTTPS. You can still choose an audio file.', true);
    return;
  }
  microphonePending = true;
  const version = ++captureVersion;
  updateControls();
  message('Allow microphone access to start recording.');
  let stream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    if (version !== captureVersion) {
      stream.getTracks().forEach(track => track.stop());
      return;
    }
    const mime = ['audio/webm;codecs=opus', 'audio/ogg;codecs=opus', 'audio/mp4']
      .find(type => MediaRecorder.isTypeSupported(type));
    const capture = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
    recorder = capture;
    let chunks = [];
    let bytes = 0;
    let failed = false;
    capture.ondataavailable = event => {
      if (event.data.size) {
        chunks.push(event.data);
        bytes += event.data.size;
        if (bytes > MAX_BYTES && capture.state === 'recording') stopRecording();
      }
    };
    capture.onerror = () => {
      failed = true;
      message('Recording failed. Check your microphone and try again.', true);
      if (capture.state !== 'inactive') capture.stop();
      stream.getTracks().forEach(track => track.stop());
      clearInterval(timer);
      recording = false;
      updateControls();
    };
    capture.onstop = () => {
      stream.getTracks().forEach(track => track.stop());
      clearInterval(timer);
      recording = false;
      recorder = null;
      const blob = new Blob(chunks, { type: capture.mimeType || chunks[0]?.type || 'audio/webm' });
      chunks = [];
      if (!failed && blob.size > 0 && blob.size <= MAX_BYTES) {
        const extension = blob.type.includes('mp4') ? 'm4a' : blob.type.includes('ogg') ? 'ogg' : 'webm';
        setAudio(blob, `speaking-${new Date().toISOString().replace(/[:.]/g, '-')}.${extension}`);
        message('Listen back if you like, then send for review.');
      } else if (!failed) {
        message('The recording was empty or exceeded 8 MB. Please try a shorter attempt.', true);
      }
      $('record-label').textContent = current ? 'Audio ready' : 'Ready to record';
      updateControls();
    };
    capture.start(500);
    recording = true;
    $('audio').pause();
    document.querySelectorAll('#reviews audio').forEach(audio => audio.pause());
    $('record-label').textContent = 'Recording';
    $('timer').textContent = '0:00';
    const started = Date.now();
    timer = setInterval(() => {
      const seconds = Math.floor((Date.now() - started) / 1000);
      $('timer').textContent = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
      if (seconds >= 180) stopRecording();
    }, 250);
    message('Speak at your own pace. Stop when you have finished your message.');
  } catch (error) {
    stream?.getTracks().forEach(track => track.stop());
    message('Cannot start the microphone. Check browser permissions, or choose an audio file.', true);
  } finally {
    microphonePending = false;
    updateControls();
  }
}

function stopRecording() {
  if (recorder?.state === 'recording') {
    // Keep recording=true until the final dataavailable and stop events finish.
    recorder.stop();
    $('stop').disabled = true;
    message('Preparing your recording…');
  }
}

function addReview(data, audio, modelTitle) {
  const url = URL.createObjectURL(audio.blob);
  const article = document.createElement('article');
  article.className = 'card review';
  const heading = document.createElement('h3');
  heading.textContent = `Attempt ${++attempt}`;
  const meta = document.createElement('p');
  meta.className = 'meta';
  meta.textContent = `${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} · ${data.prompt} · ${modelTitle}`;
  const player = document.createElement('audio');
  player.controls = true;
  player.preload = 'none';
  player.src = url;
  player.setAttribute('aria-label', `Listen to attempt ${attempt}`);
  const text = document.createElement('div');
  text.className = 'review-text';
  text.lang = 'vi';
  // Support bold emphasis without interpreting any AI-provided HTML or links.
  for (const part of data.review.split(/(\*\*[^*\n]+\*\*)/g)) {
    if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
      const strong = document.createElement('strong');
      strong.textContent = part.slice(2, -2);
      text.append(strong);
    } else {
      text.append(document.createTextNode(part));
    }
  }
  article.append(heading, meta, player, text);
  $('reviews').prepend(article);
  history.unshift({ article, url });
  if (history.length > 6) {
    const removed = history.pop();
    removed.article.querySelector('audio').pause();
    removed.article.remove();
    URL.revokeObjectURL(removed.url);
  }
  $('count').textContent = String(history.length);
  $('empty').hidden = true;
}

async function sendReview() {
  if (!current || request || recording || microphonePending || !config?.available || loading) return;
  const prompt = config.prompts.find(item => item.id === $('prompt').value);
  if (!prompt) return;
  const audio = current;
  const model = $('model').value;
  const version = ++requestVersion;
  const controller = new AbortController();
  request = controller;
  updateControls();
  const body = new FormData();
  body.append('prompt', prompt.id);
  body.append('revision', prompt.revision);
  body.append('model', model);
  body.append('audio', audio.blob, audio.name);
  message('Sending audio and waiting for AI feedback…');
  $('send').textContent = 'Reviewing…';
  let timedOut = false;
  const timeout = setTimeout(() => { timedOut = true; controller.abort(); }, 90000);
  try {
    const response = await englishPracticeFetch('review', { method: 'POST', body, signal: controller.signal });
    let data;
    try { data = await response.json(); }
    catch (error) { throw new Error(`The server returned HTTP ${response.status} without a readable review. Try again.`); }
    if (version !== requestVersion) return;
    if (!response.ok) throw new Error(data.error || `Review failed (HTTP ${response.status}).`);
    if (typeof data.review !== 'string' || !data.review.trim()) throw new Error('AI returned an empty review. Try again.');
    addReview(data, audio, config.models[model]);
    message('Feedback is ready below. Record another attempt when you are ready.');
  } catch (error) {
    if (version !== requestVersion) return;
    message(error.name === 'AbortError' ? (timedOut ? 'The review timed out. Your audio is still available to send again.' : 'Review cancelled.') : error.message, true);
  } finally {
    clearTimeout(timeout);
    if (version === requestVersion) {
      request = null;
      $('send').textContent = 'Send for review';
      updateControls();
    }
  }
}

$('record').addEventListener('click', startRecording);
$('stop').addEventListener('click', stopRecording);
$('send').addEventListener('click', sendReview);
$('prompt').addEventListener('change', showPrompt);
$('reload').addEventListener('click', loadConfig);
$('cancel').addEventListener('click', () => {
  if (!request) return;
  ++requestVersion;
  request.abort();
  request = null;
  $('send').textContent = 'Send for review';
  message('Review cancelled. Your audio is still available. A request already received by Google may still finish.');
  updateControls();
});
$('audio-file').addEventListener('change', event => {
  const file = event.target.files[0];
  event.target.value = '';
  if (!file) return;
  if (!file.size || file.size > MAX_BYTES) {
    message('Choose a nonempty audio file no larger than 8 MB.', true);
    return;
  }
  $('audio').pause();
  setAudio(file, file.name);
  $('timer').textContent = '—';
  message('Audio file ready. Listen back or send for review.');
});
$('clear').addEventListener('click', () => {
  history.forEach(item => {
    item.article.querySelector('audio').pause();
    URL.revokeObjectURL(item.url);
  });
  history = [];
  $('reviews').replaceChildren();
  $('count').textContent = '0';
  $('empty').hidden = false;
  updateControls();
});
window.addEventListener('pagehide', () => {
  ++captureVersion;
  ++requestVersion;
  request?.abort();
  request = null;
  clearInterval(timer);
  if (recorder && recorder.state !== 'inactive') recorder.stop();
});
window.addEventListener('pageshow', event => { if (event.persisted) { updateControls(); loadConfig(); } });
loadConfig();

window.addEventListener('gemini-key-changed', event => {
  if (!config) return;
  config.available = event.detail.configured;
  $('config-status').textContent = config.available ? 'AI is ready. Feedback will be in Vietnamese.'
    : 'Enter your Gemini API key in Gemini settings to enable reviews.';
  updateControls();
});
