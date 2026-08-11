/**
 * Firebase Authentication — login, signup, logout, and session handling.
 */

import { auth } from './firebase.js';
import { createUserProfile } from './userProfile.js';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  signOut,
  onAuthStateChanged,
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';

const errorEl = document.getElementById('auth-error');
const successEl = document.getElementById('auth-success');
const loginForm = document.getElementById('login-form');
const signupForm = document.getElementById('signup-form');

// ── Exported helpers (used by dashboard and other protected pages) ─────────

/** Returns a promise that resolves with the current user, or null if signed out. */
export function getCurrentUser() {
  return new Promise((resolve) => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      unsubscribe();
      resolve(user);
    });
  });
}

/** Redirects to login.html if no user is signed in; otherwise calls onUser(user). */
export function requireAuth(onUser) {
  onAuthStateChanged(auth, (user) => {
    if (!user) {
      window.location.href = 'login.html';
      return;
    }
    onUser(user);
  });
}

/** Signs the user out and redirects to the landing page. */
export async function logout(redirectTo = 'index.html') {
  await signOut(auth);
  window.location.href = redirectTo;
}

// ── Message helpers ───────────────────────────────────────────────────────

function hideMessages() {
  if (errorEl) errorEl.hidden = true;
  if (successEl) successEl.hidden = true;
}

function showError(message) {
  hideMessages();
  if (!errorEl) return;
  errorEl.textContent = message;
  errorEl.hidden = false;
}

function showSuccess(message) {
  hideMessages();
  if (!successEl) return;
  successEl.textContent = message;
  successEl.hidden = false;
}

function setLoading(button, loading) {
  if (!button) return;
  button.disabled = loading;
  button.textContent = loading ? 'Please wait…' : button.dataset.originalText;
}

function getAuthErrorMessage(code) {
  const messages = {
    'auth/invalid-email': 'Please enter a valid email address.',
    'auth/user-disabled': 'This account has been disabled.',
    'auth/user-not-found': 'No account found with this email.',
    'auth/wrong-password': 'Incorrect password. Please try again.',
    'auth/invalid-credential': 'Invalid email or password.',
    'auth/email-already-in-use': 'An account with this email already exists.',
    'auth/weak-password': 'Password must be at least 6 characters.',
    'auth/too-many-requests': 'Too many attempts. Please try again later.',
    'auth/network-request-failed': 'Network error. Check your connection and try again.',
  };
  return messages[code] || 'Something went wrong. Please try again.';
}

// ── Redirect authenticated users away from login/signup ─────────────────────

if (loginForm) {
  onAuthStateChanged(auth, (user) => {
    if (user) {
      window.location.href = 'dashboard.html';
    }
  });
}

// Signup page: only redirect if already logged in on page load — not during signup,
// because onAuthStateChanged fires immediately after createUserWithEmailAndPassword
// and would navigate away before the Firestore write completes.
if (signupForm) {
  getCurrentUser().then((user) => {
    if (user) {
      window.location.href = 'dashboard.html';
    }
  });
}

// ── Login ───────────────────────────────────────────────────────────────────

if (loginForm) {
  const loginBtn = document.getElementById('login-btn');
  if (loginBtn) loginBtn.dataset.originalText = 'Log In';

  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideMessages();
    setLoading(loginBtn, true);

    const email = loginForm.email.value.trim();
    const password = loginForm.password.value;

    try {
      await signInWithEmailAndPassword(auth, email, password);
      showSuccess('Login successful! Redirecting…');
      window.location.href = 'dashboard.html';
    } catch (err) {
      showError(getAuthErrorMessage(err.code));
    } finally {
      setLoading(loginBtn, false);
    }
  });
}

// ── Signup ──────────────────────────────────────────────────────────────────

if (signupForm) {
  const signupBtn = document.getElementById('signup-btn');
  if (signupBtn) signupBtn.dataset.originalText = 'Create Account';

  signupForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideMessages();
    setLoading(signupBtn, true);

    const displayName = signupForm.displayName.value.trim();
    const email = signupForm.email.value.trim();
    const password = signupForm.password.value;

    try {
      const credential = await createUserWithEmailAndPassword(auth, email, password);
      const { user } = credential;

      if (displayName) {
        await updateProfile(user, { displayName });
      }

      // Firestore write runs only after Auth account exists and user.uid is available
      await createUserProfile(user, { name: displayName, email });

      showSuccess('Account created! Redirecting to dashboard…');
      window.location.href = 'dashboard.html';
    } catch (err) {
      console.error('Signup failed:', err.code, err.message, err);

      if (err.code === 'permission-denied') {
        showError('Account created, but profile could not be saved. Check Firestore security rules.');
      } else if (err.code) {
        showError(getAuthErrorMessage(err.code));
      } else {
        showError('Could not create your profile. Please try again.');
      }
    } finally {
      setLoading(signupBtn, false);
    }
  });
}
