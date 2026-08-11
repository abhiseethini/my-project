/**
 * Firebase initialization (modular SDK)
 *
 * Paste your Firebase web app configuration below.
 * Firebase Console → Project Settings → Your apps → Web app → SDK setup and configuration
 */

import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';
import { getFirestore } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
import { getStorage } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-storage.js';

// ── PASTE YOUR FIREBASE WEB APP CONFIG HERE ──────────────────────────────
// Replace every placeholder below with the values from your Firebase project.
const firebaseConfig = {
  apiKey: "AIzaSyB_Vao6qBPRr790VbZda2dd-P5S9ZrNTaA",
  authDomain: "my-project-530db.firebaseapp.com",
  databaseURL: "https://my-project-530db-default-rtdb.firebaseio.com",
  projectId: "my-project-530db",
  storageBucket: "my-project-530db.firebasestorage.app",
  messagingSenderId: "593950178986",
  appId: "1:593950178986:web:4742ce969db6023d799ad3"
};

// ── END FIREBASE CONFIG ──────────────────────────────────────────────────

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
