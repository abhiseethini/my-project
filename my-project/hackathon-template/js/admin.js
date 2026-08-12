/**
 * Central Admin Module (admin.js)
 * Controls all Admin Pages: Admin Signup, Admin Login, Admin Dashboard & Admin Panel.
 */

import { auth, db } from './firebase.js';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  signOut,
  onAuthStateChanged,
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';
import {
  doc,
  getDoc,
  setDoc,
  collection,
  getDocs,
  query,
  orderBy,
  serverTimestamp,
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

// Secret key for admin registration
export const ADMIN_SECRET_KEY = 'ADMIN123';

// ── Exported Page Router / Navigation Helpers ────────────────────────────────

export function navigateToAdminLogin() {
  window.location.href = 'admin-login.html';
}

export function navigateToAdminSignup() {
  window.location.href = 'admin-signup.html';
}

export function navigateToAdminDashboard() {
  window.location.href = 'admin-dashboard.html';
}

/** Signs user out and redirects to Admin Login */
export async function adminLogout() {
  try {
    await signOut(auth);
  } catch (err) {
    console.error('Logout error:', err);
  } finally {
    navigateToAdminLogin();
  }
}

/** Verifies if a user has role === "admin" in Firestore users/{uid} */
export async function verifyAdminRole(uid) {
  try {
    const userDocRef = doc(db, 'users', uid);
    const userDocSnap = await getDoc(userDocRef);
    return userDocSnap.exists() && userDocSnap.data().role === 'admin';
  } catch (err) {
    console.error('Error verifying admin role in Firestore:', err);
    return false;
  }
}

// ── DOM Elements Detection for Current Admin Page ──────────────────────────

const loginForm = document.getElementById('admin-login-form');
const signupForm = document.getElementById('admin-signup-form');
const dashboardContent = document.getElementById('admin-dashboard-content');
const adminPanelContent = document.getElementById('admin-content');
const accessDeniedBanner = document.getElementById('access-denied-banner');

const errorEl = document.getElementById('auth-error');
const successEl = document.getElementById('auth-success');

const logoutBtns = document.querySelectorAll('#logout-btn, #admin-logout-btn, #admin-logout-action-btn');

// ── Message Helpers ────────────────────────────────────────────────────────

function hideMessages() {
  if (errorEl) {
    errorEl.textContent = '';
    errorEl.hidden = true;
  }
  if (successEl) {
    successEl.textContent = '';
    successEl.hidden = true;
  }
}

function showError(msg) {
  hideMessages();
  if (errorEl) {
    errorEl.textContent = msg;
    errorEl.hidden = false;
  }
}

function showSuccess(msg) {
  hideMessages();
  if (successEl) {
    successEl.textContent = msg;
    successEl.hidden = false;
  }
}

function getAuthErrorMessage(code) {
  const messages = {
    'auth/invalid-email': 'Please enter a valid email address.',
    'auth/user-disabled': 'This account has been disabled.',
    'auth/user-not-found': 'No account found with this email.',
    'auth/wrong-password': 'Incorrect password. Please try again.',
    'auth/invalid-credential': 'Invalid email or password.',
    'auth/email-already-in-use': 'An account with this email already exists.',
    'auth/weak-password': 'Password should be at least 6 characters.',
    'auth/too-many-requests': 'Too many attempts. Please try again later.',
    'auth/network-request-failed': 'Network error. Check your connection.',
  };
  return messages[code] || 'Authentication error. Please check credentials and try again.';
}

// ── 1. ADMIN SIGNUP HANDLER (if on admin-signup.html) ──────────────────────

if (signupForm) {
  const nameInput = document.getElementById('admin-name');
  const emailInput = document.getElementById('admin-email');
  const passwordInput = document.getElementById('admin-password');
  const secretInput = document.getElementById('admin-secret');
  const signupBtn = document.getElementById('admin-signup-btn');

  signupForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideMessages();

    const name = nameInput.value.trim();
    const email = emailInput.value.trim();
    const password = passwordInput.value;
    const secretKey = secretInput.value.trim();

    if (!name || !email || !password) {
      showError('Please fill in all required fields.');
      return;
    }

    if (secretKey !== ADMIN_SECRET_KEY) {
      showError('Invalid Admin Secret Key. Registration denied.');
      return;
    }

    if (signupBtn) {
      signupBtn.disabled = true;
      signupBtn.textContent = 'Registering Admin…';
    }

    try {
      // Create Firebase Auth user
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      if (name) {
        await updateProfile(user, { displayName: name });
      }

      // Create Firestore doc users/{uid} with role: "admin"
      await setDoc(doc(db, 'users', user.uid), {
        name: name,
        email: email,
        role: 'admin',
        createdAt: serverTimestamp(),
      });

      showSuccess('Admin registration successful! Redirecting to login…');
      await signOut(auth);

      setTimeout(() => {
        navigateToAdminLogin();
      }, 1200);
    } catch (err) {
      console.error('Admin Signup Error:', err);
      showError(getAuthErrorMessage(err.code));
    } finally {
      if (signupBtn) {
        signupBtn.disabled = false;
        signupBtn.textContent = 'Register as Admin';
      }
    }
  });
}

// ── 2. ADMIN LOGIN HANDLER (if on admin-login.html) ─────────────────────────

if (loginForm) {
  const emailInput = document.getElementById('admin-email');
  const passwordInput = document.getElementById('admin-password');
  const loginBtn = document.getElementById('admin-login-btn');

  // Check if admin is already logged in
  onAuthStateChanged(auth, async (user) => {
    if (user) {
      const isAdmin = await verifyAdminRole(user.uid);
      if (isAdmin) {
        navigateToAdminDashboard();
      }
    }
  });

  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideMessages();

    const email = emailInput.value.trim();
    const password = passwordInput.value;

    if (!email || !password) {
      showError('Please enter both email and password.');
      return;
    }

    if (loginBtn) {
      loginBtn.disabled = true;
      loginBtn.textContent = 'Authenticating…';
    }

    try {
      // 1. Firebase Sign In
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // 2. Role Check
      const isAdmin = await verifyAdminRole(user.uid);

      if (isAdmin) {
        showSuccess('Admin access granted! Redirecting…');
        setTimeout(() => {
          navigateToAdminDashboard();
        }, 500);
      } else {
        showError('Access denied. You do not have administrator privileges.');
        await signOut(auth);
      }
    } catch (err) {
      console.error('Admin Login Error:', err);
      showError(getAuthErrorMessage(err.code));
    } finally {
      if (loginBtn) {
        loginBtn.disabled = false;
        loginBtn.textContent = 'Login as Admin';
      }
    }
  });
}

// ── 3. PROTECTED DASHBOARD / PANEL HANDLER (if on dashboard or admin.html) ──

if (dashboardContent || adminPanelContent) {
  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      navigateToAdminLogin();
      return;
    }

    const userDocRef = doc(db, 'users', user.uid);
    const userDocSnap = await getDoc(userDocRef);

    if (!userDocSnap.exists() || userDocSnap.data().role !== 'admin') {
      if (accessDeniedBanner) accessDeniedBanner.hidden = false;
      await signOut(auth);
      setTimeout(() => {
        navigateToAdminLogin();
      }, 1000);
      return;
    }

    const userData = userDocSnap.data();
    const adminName = userData.name || user.displayName || 'Campus Admin';
    const adminEmail = userData.email || user.email || 'admin@college.edu';

    // Populate Dashboard info
    const greetingEl = document.getElementById('admin-greeting');
    const welcomeEl = document.getElementById('admin-welcome-text');
    const nameEl = document.getElementById('admin-name');
    const emailEl = document.getElementById('admin-email');
    const uidEl = document.getElementById('admin-uid');

    if (greetingEl) greetingEl.textContent = `Hi, ${adminName}`;
    if (welcomeEl) welcomeEl.textContent = `Welcome, ${adminName}. You are logged in as Administrator.`;
    if (nameEl) nameEl.textContent = adminName;
    if (emailEl) emailEl.textContent = adminEmail;
    if (uidEl) uidEl.textContent = user.uid;

    if (dashboardContent) dashboardContent.hidden = false;
    if (adminPanelContent) adminPanelContent.hidden = false;

    // Load users table if present on page
    loadUsersTable();
  });
}

// ── Load Users Table Helper ────────────────────────────────────────────────

async function loadUsersTable() {
  const usersTableBody = document.getElementById('users-table-body');
  const statUsers = document.getElementById('stat-users');
  const statAdmins = document.getElementById('stat-admins');

  if (!usersTableBody) return;

  try {
    const snapshot = await getDocs(query(collection(db, 'users'), orderBy('createdAt', 'desc')));
    const users = snapshot.docs.map((d) => d.data());

    if (statUsers) statUsers.textContent = users.length;
    if (statAdmins) statAdmins.textContent = users.filter((u) => u.role === 'admin').length;

    if (users.length === 0) {
      usersTableBody.innerHTML = '<tr><td colspan="4" class="text-muted">No users found.</td></tr>';
      return;
    }

    usersTableBody.innerHTML = users
      .map(
        (u) => `
      <tr>
        <td>${escapeHtml(u.name || u.displayName || '—')}</td>
        <td>${escapeHtml(u.email || '—')}</td>
        <td><span class="role-badge ${u.role || 'user'}">${u.role || 'user'}</span></td>
        <td>${formatDate(u.createdAt)}</td>
      </tr>
    `
      )
      .join('');
  } catch (err) {
    console.error('Error loading users:', err);
    usersTableBody.innerHTML =
      '<tr><td colspan="4" class="text-muted">Could not load users. Check Firestore rules.</td></tr>';
  }
}

function formatDate(timestamp) {
  if (!timestamp) return '—';
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// ── 4. LOGOUT EVENT LISTENERS ───────────────────────────────────────────────

logoutBtns.forEach((btn) => {
  btn.addEventListener('click', adminLogout);
});

// Re-check session on browser back button
window.addEventListener('pageshow', (event) => {
  if (event.persisted && (dashboardContent || adminPanelContent) && !auth.currentUser) {
    navigateToAdminLogin();
  }
});
