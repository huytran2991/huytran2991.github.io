import { auth, onAuthStateChanged, signInWithGoogle, signOut } from '../firebase-client.js';
import { updatePractice } from '../practice-store.js';
import { readGeminiKey, removeGeminiKey, saveGeminiKey } from '../gemini-settings.js';

const progressPath = 'Duo/progress.json';
const importKey = 'duo-grade3-guest-imported';
const profileKey = uid => 'duo-grade3-account-v1.' + uid;
const validCompletions = values => Array.isArray(values)
  ? values.filter(value => /^(?:[1-9]|10)\/(?:matching|quiz|listening|sentences|translation|mixed)$/.test(value))
  : [];
const union = (first, second) => [...new Set([...first, ...second])];

function localRead(key) {
  try { return localStorage.getItem(key); }
  catch { return null; }
}

function localWrite(key, value) {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

function decode(value) {
  try { return JSON.parse(value) || {}; }
  catch { return {}; }
}

function accountCache(uid) {
  const data = decode(localRead(profileKey(uid)));
  return {
    completed: validCompletions(data.completed),
    voice: typeof data.voice === 'string' ? data.voice : '',
    key: typeof data.key === 'string' ? data.key : '',
    pendingProgress: data.pendingProgress === true,
    pendingVoice: data.pendingVoice === true,
    pendingKey: data.pendingKey === true
  };
}

function readProgress(uid) {
  return updatePractice(uid, files => decode(files[progressPath]), undefined, { createIfMissing: true });
}

function syncProgress(uid, profile) {
  return updatePractice(uid, files => {
    const remote = decode(files[progressPath]);
    const merged = {
      completed: union(validCompletions(remote.completed), profile.completed),
      voice: profile.pendingVoice ? profile.voice : remote.voice
    };
    files[progressPath] = JSON.stringify(merged);
    return merged;
  }, undefined, { createIfMissing: true });
}

export function setupDuoAccount({ guest, apply, loading }) {
  const login = document.querySelector('#duo-login');
  const logout = document.querySelector('#duo-logout');
  const email = document.querySelector('#duo-email');
  const status = document.querySelector('#duo-account-status');
  let session;
  let importedBy = localRead(importKey);

  function persist(current) {
    return localWrite(profileKey(current.uid), JSON.stringify(current.profile));
  }

  async function synchronize(current) {
    if (current.running) return;
    current.running = true;
    const { uid, profile } = current;
    try {
      if (!current.loaded) {
        const [remote, key] = await Promise.all([readProgress(uid), readGeminiKey(uid)]);
        if (current !== session) return;
        const localGuest = importedBy ? null : guest();
        const remoteCompleted = validCompletions(remote.completed);
        profile.completed = union(union(remoteCompleted, profile.completed), localGuest?.completed || []);
        profile.pendingProgress ||= profile.completed.some(item => !remoteCompleted.includes(item));
        if (!profile.pendingVoice) {
          profile.voice = typeof remote.voice === 'string' ? remote.voice : localGuest?.voice || '';
          profile.pendingVoice = typeof remote.voice !== 'string' && Boolean(profile.voice);
        }
        if (!profile.pendingKey) {
          profile.key = key || localGuest?.key || '';
          profile.pendingKey = !key && Boolean(profile.key);
        }
        if (localGuest) {
          importedBy = uid;
          localWrite(importKey, uid);
        }
        current.loaded = true;
        persist(current);
        apply(profile);
        loading(false);
      }

      while (current === session && (profile.pendingProgress || profile.pendingVoice || profile.pendingKey)) {
        const sent = { ...profile, completed: [...profile.completed] };
        status.textContent = 'Đang đồng bộ…';
        if (sent.pendingProgress || sent.pendingVoice) {
          const remote = await syncProgress(uid, sent);
          if (current !== session) return;
          profile.pendingProgress = profile.completed.some(item => !remote.completed.includes(item));
          profile.completed = union(remote.completed, profile.completed);
          if (profile.voice === sent.voice) {
            profile.pendingVoice = false;
            if (typeof remote.voice === 'string') profile.voice = remote.voice;
          }
          persist(current);
          apply(profile);
        }
        if (sent.pendingKey && profile.key === sent.key) {
          if (sent.key) await saveGeminiKey(uid, sent.key);
          else await removeGeminiKey(uid);
          if (current !== session) return;
          if (profile.key === sent.key) profile.pendingKey = false;
          persist(current);
        }
      }
      if (current === session) status.textContent = '';
    } catch {
      if (current !== session) return;
      status.textContent = 'Chưa đồng bộ được. Duo đang dùng dữ liệu trên thiết bị này.';
      if (!current.loaded) {
        apply(profile);
        loading(false);
      }
    } finally {
      current.running = false;
    }
  }

  login.addEventListener('click', async () => {
    login.disabled = true;
    status.textContent = 'Đang mở Google Sign-In…';
    try {
      await signInWithGoogle();
    } catch (error) {
      status.textContent = error.code === 'auth/unauthorized-domain'
        ? 'Tên miền này chưa được phép đăng nhập Google.'
        : 'Chưa đăng nhập được. Hãy thử lại.';
    } finally {
      login.disabled = false;
    }
  });
  logout.addEventListener('click', async () => {
    logout.disabled = true;
    try { await signOut(auth); }
    catch { status.textContent = 'Chưa đăng xuất được. Hãy thử lại.'; }
    finally { logout.disabled = false; }
  });
  onAuthStateChanged(auth, user => {
    email.textContent = user?.email || '';
    email.hidden = !user;
    login.hidden = Boolean(user);
    logout.hidden = !user;
    login.disabled = false;
    session = user ? { uid: user.uid, profile: accountCache(user.uid) } : undefined;
    loading(Boolean(user), true);
    if (session) {
      status.textContent = 'Đang tải tiến độ…';
      void synchronize(session);
    } else {
      status.textContent = '';
      apply(guest());
    }
  }, () => {
    loading(false);
    status.textContent = 'Chưa kiểm tra được đăng nhập Google.';
    login.disabled = false;
  });

  window.addEventListener('online', () => { if (session) void synchronize(session); });
  return {
    save(field, value) {
      if (!session) return undefined;
      const { profile } = session;
      profile[field] = field === 'completed' ? union(profile.completed, value) : value;
      const flag = { completed: 'pendingProgress', voice: 'pendingVoice', key: 'pendingKey' }[field];
      profile[flag] = true;
      const stored = persist(session);
      void synchronize(session);
      return stored;
    }
  };
}
