'use strict';

let practiceAuth;

async function currentPracticeUser() {
  practiceAuth ??= import('./firebase-client.js').then(async ({ auth }) => {
    await auth.authStateReady();
    return auth;
  });
  const auth = await practiceAuth;
  if (!auth.currentUser) {
    location.replace('../');
    throw new Error('Sign in with Google to open English Practice.');
  }
  return auth.currentUser;
}

function practiceResponse(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
}

// Keep the UI's response contract while dispatching to local Firebase SDK operations.
async function englishPracticeFetch(path, options = {}) {
  const url = new URL(path, location.href);
  const pageFolder = new URL('./', location.href);
  if (new URL('./', url).href !== pageFolder.href) throw new Error('Invalid English Practice action.');
  const tool = pageFolder.pathname.split('/').at(-2).toLowerCase();
  const action = url.pathname.split('/').at(-1);
  const signal = options.signal;

  try {
    signal?.throwIfAborted();
    const user = await currentPracticeUser();
    const { practiceAction } = await import('./practice-actions.js');
    signal?.throwIfAborted();
    const result = await practiceAction(user.uid, tool, action, url.searchParams, options);
    signal?.throwIfAborted();
    return practiceResponse(result);
  } catch (error) {
    if (signal?.aborted || error.name === 'AbortError') throw error;
    const status = error.status || (error.code === 'permission-denied' ? 403 : 500);
    return practiceResponse({ error: error.message || 'English Practice could not complete this action.',
      serviceStatus: status, retryable: error.retryable === true }, status);
  }
}

const geminiSettings = document.getElementById('gemini-settings');
if (geminiSettings) {
  const input = document.getElementById('gemini-key');
  const status = document.getElementById('gemini-key-status');
  const remove = document.getElementById('gemini-key-remove');

  async function updateGeminiSettings(operation) {
    try {
      const user = await currentPracticeUser();
      const { getGeminiKey, saveGeminiKey, removeGeminiKey } = await import('./practice-ai.js');
      if (operation === 'save') saveGeminiKey(user.uid, input.value);
      if (operation === 'remove') removeGeminiKey(user.uid);
      const configured = !!getGeminiKey(user.uid);
      status.textContent = configured ? 'A Gemini key is saved in this browser.' : 'Enter your Gemini API key to enable AI reviews.';
      remove.disabled = !configured;
      if (operation) {
        input.value = '';
        window.dispatchEvent(new CustomEvent('gemini-key-changed', { detail: { configured } }));
      }
    } catch (error) {
      status.textContent = error.message || 'Could not update Gemini settings.';
    }
  }

  geminiSettings.querySelector('form').addEventListener('submit', event => {
    event.preventDefault();
    updateGeminiSettings('save');
  });
  remove.addEventListener('click', () => updateGeminiSettings('remove'));
  updateGeminiSettings();
}
