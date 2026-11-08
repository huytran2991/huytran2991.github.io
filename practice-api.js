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
  const badge = document.getElementById('gemini-key-badge');
  const save = geminiSettings.querySelector('button[type="submit"]');
  const remove = document.getElementById('gemini-key-remove');
  let configured = false;

  async function updateGeminiSettings(operation) {
    save.disabled = remove.disabled = true;
    try {
      const user = await currentPracticeUser();
      const { readGeminiKey, saveGeminiKey, removeGeminiKey } = await import('./gemini-settings.js');
      if (operation === 'save') {
        await saveGeminiKey(user.uid, input.value);
        configured = true;
      } else if (operation === 'remove') {
        await removeGeminiKey(user.uid);
        configured = false;
      } else {
        configured = !!await readGeminiKey(user.uid);
      }
      badge.dataset.source = configured ? 'account' : 'none';
      badge.textContent = configured ? 'Key saved' : 'No key';
      status.textContent = configured ? 'Your Gemini key is saved to your Google account settings.'
        : 'Enter your Gemini API key to enable AI reviews.';
      if (operation) {
        input.value = '';
        window.dispatchEvent(new CustomEvent('gemini-key-changed', { detail: { configured } }));
      }
    } catch (error) {
      if (!operation) badge.textContent = 'Unavailable';
      status.textContent = error.code === 'permission-denied'
        ? 'Firestore denied access to your account settings. Check the settings permissions.'
        : error.message || 'Could not update Gemini settings.';
    } finally {
      save.disabled = false;
      remove.disabled = !configured;
    }
  }

  geminiSettings.querySelector('form').addEventListener('submit', event => {
    event.preventDefault();
    updateGeminiSettings('save');
  });
  remove.addEventListener('click', () => updateGeminiSettings('remove'));
  updateGeminiSettings();
}
