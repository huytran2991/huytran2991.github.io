import { app } from './firebase-client.js';
import { doc, getDocFromServer, getFirestore, runTransaction }
  from 'https://www.gstatic.com/firebasejs/13.2.0/firebase-firestore.js';

const db = getFirestore(app);
const encoder = new TextEncoder();
const decoder = new TextDecoder('utf-8', { ignoreBOM: true, fatal: true });
const maxChunks = 10;
const chunkSize = 700000;

function snapshotRefs(uid) {
  return index => doc(db, 'users', uid, 'englishPractice', index ? `v1-chunk-${index}` : 'v1');
}

async function loadSnapshot(ref, get, createIfMissing = false) {
  const root = (await get(ref(0))).data();
  if (!root && createIfMissing) return { files: Object.create(null), count: 0 };
  if (!root) throw new Error('No English Practice data was found for this Google account.');
  if (root.schemaVersion !== 1 || !Number.isInteger(root.chunkCount) ||
      root.chunkCount < 1 || root.chunkCount > maxChunks || typeof root.revision !== 'string' ||
      typeof root.payload !== 'string') {
    throw new Error('The saved practice data has an invalid format.');
  }
  const parts = await Promise.all(Array.from({ length: root.chunkCount - 1 }, (_, index) => get(ref(index + 1))));
  let payload = root.payload;
  for (const part of parts) {
    const data = part.data();
    if (data?.revision !== root.revision || typeof data.payload !== 'string') return null;
    payload += data.payload;
  }
  const files = JSON.parse(payload);
  if (!files || typeof files !== 'object' || (Array.isArray(files) && files.length) ||
      Object.values(files).some(value => typeof value !== 'string')) {
    throw new Error('The saved practice data has an invalid format.');
  }
  return { files: Object.assign(Object.create(null), files), count: root.chunkCount };
}

function splitPayload(payload) {
  const bytes = encoder.encode(payload);
  const chunks = [];
  for (let start = 0; start < bytes.length;) {
    let end = Math.min(start + chunkSize, bytes.length);
    while ((bytes[end] & 0xc0) === 0x80) end--;
    chunks.push(decoder.decode(bytes.subarray(start, end)));
    start = end;
  }
  if (chunks.length > maxChunks) throw new Error('The saved practice data exceeds the storage limit.');
  return chunks;
}

export async function readPractice(uid) {
  const ref = snapshotRefs(uid);
  for (let attempt = 0; attempt < 2; attempt++) {
    const snapshot = await loadSnapshot(ref, getDocFromServer);
    if (snapshot) return snapshot.files;
  }
  throw new Error('Practice data changed while loading. Reload and try again.');
}

export function updatePractice(uid, apply, signal, { createIfMissing = false } = {}) {
  const ref = snapshotRefs(uid);
  return runTransaction(db, async transaction => {
    signal?.throwIfAborted();
    const snapshot = await loadSnapshot(ref, key => transaction.get(key), createIfMissing);
    if (!snapshot) throw new Error('Practice data changed while loading. Reload and try again.');
    const before = JSON.stringify(snapshot.files);
    const result = await apply(snapshot.files);
    signal?.throwIfAborted();
    const after = JSON.stringify(snapshot.files);
    if (before === after) return result;

    const chunks = splitPayload(after);
    const revision = crypto.randomUUID();
    chunks.forEach((payload, index) => {
      const fields = { revision, payload };
      if (index === 0) Object.assign(fields, { schemaVersion: 1, chunkCount: chunks.length });
      transaction.set(ref(index), fields);
    });
    for (let index = chunks.length; index < snapshot.count; index++) transaction.delete(ref(index));
    return result;
  });
}
