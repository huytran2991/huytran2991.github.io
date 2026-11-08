'use strict';

const practiceAuth = import('./firebase-client.js').then(async ({ auth }) => {
  await auth.authStateReady();
  return auth;
});

async function englishPracticeFetch(path, options = {}) {
  const url = new URL(path, location.href);
  if (url.origin !== location.origin) {
    throw new Error('Invalid English Practice API URL.');
  }

  const auth = await practiceAuth;
  if (!auth.currentUser) {
    location.replace('../');
    throw new Error('Sign in with Google to open English Practice.');
  }

  const headers = new Headers(options.headers);
  headers.set('X-English-ID-Token', await auth.currentUser.getIdToken());
  return fetch(url, { ...options, headers, redirect: 'error' });
}
