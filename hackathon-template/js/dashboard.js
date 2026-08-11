/**
 * Dashboard page — UI only; auth handled by auth.js.
 */

import { requireAuth, logout } from './auth.js';

const greetingEl = document.getElementById('user-greeting');
const welcomeEl = document.getElementById('welcome-message');
const nameEl = document.getElementById('profile-name');
const emailEl = document.getElementById('profile-email');
const uidEl = document.getElementById('profile-uid');
const logoutBtn = document.getElementById('logout-btn');

requireAuth((user) => {
  const displayName = user.displayName || 'User';

  greetingEl.textContent = `Hi, ${displayName}`;
  welcomeEl.textContent = `Welcome back, ${displayName}!`;
  nameEl.textContent = displayName;
  emailEl.textContent = user.email;
  uidEl.textContent = user.uid;
});

logoutBtn.addEventListener('click', () => logout('index.html'));
