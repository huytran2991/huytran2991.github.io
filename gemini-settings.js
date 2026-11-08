import { app } from './firebase-client.js';
import { deleteDoc, doc, getDocFromServer, getFirestore, setDoc }
  from 'https://www.gstatic.com/firebasejs/13.2.0/firebase-firestore.js';

const db = getFirestore(app);
const settingsRef = uid => doc(db, 'users', uid, 'private', 'gemini');

export async function readGeminiKey(uid) {
  try {
    localStorage.removeItem(`english-practice.gemini-key.${uid}`);
  } catch {
    // Legacy cleanup is best effort if the browser blocks access to local storage.
  }
  const settings = await getDocFromServer(settingsRef(uid));
  const key = settings.data()?.apiKey;
  return typeof key === 'string' ? key : '';
}

export async function hasGeminiKey(uid) {
  try {
    return !!(await readGeminiKey(uid));
  } catch {
    return false;
  }
}

export async function saveGeminiKey(uid, input) {
  const key = input.trim();
  if (!/^[!-~]{1,256}$/.test(key)) throw new Error('Enter a valid Gemini API key.');
  await setDoc(settingsRef(uid), { apiKey: key });
}

export async function removeGeminiKey(uid) {
  await deleteDoc(settingsRef(uid));
}
