import { initializeApp } from 'https://www.gstatic.com/firebasejs/13.2.0/firebase-app.js';
import { getAuth, GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signOut }
  from 'https://www.gstatic.com/firebasejs/13.2.0/firebase-auth.js';

const app = initializeApp({"apiKey": "AIzaSyBeA6AoCyF1WjvVJw2BWmtUYyOQ1VCpMJo", "authDomain": "english-practice-e5ebd.firebaseapp.com", "projectId": "english-practice-e5ebd", "appId": "1:167826255253:web:94e29c8123fb933eba1a9c"});
const auth = getAuth(app);

function signInWithGoogle() {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  return signInWithPopup(auth, provider);
}

export { app, auth, onAuthStateChanged, signInWithGoogle, signOut };
