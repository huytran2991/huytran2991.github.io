// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyBeA6AoCyF1WjvVJw2BWmtUYyOQ1VCpMJo",
  authDomain: "english-practice-e5ebd.firebaseapp.com",
  projectId: "english-practice-e5ebd",
  storageBucket: "english-practice-e5ebd.firebasestorage.app",
  messagingSenderId: "167826255253",
  appId: "1:167826255253:web:94e29c8123fb933eba1a9c",
  measurementId: "G-3MXHFZ1RPJ"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();
