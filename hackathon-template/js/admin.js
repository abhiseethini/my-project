/**
 * Admin panel — requires authenticated user with role "admin".
 */

import { auth, db } from './firebase.js';
import { onAuthStateChanged, signOut } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';
import { collection, getDocs, query, orderBy } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
import { doc, getDoc } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

const deniedEl = document.getElementById('admin-denied');
const contentEl = document.getElementById('admin-content');
const usersTableBody = document.getElementById('users-table-body');
const statUsers = document.getElementById('stat-users');
const statAdmins = document.getElementById('stat-admins');
const logoutBtn = document.getElementById('logout-btn');

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = 'login.html';
    return;
  }

  const userDoc = await getDoc(doc(db, 'users', user.uid));
  const role = userDoc.exists() ? userDoc.data().role : 'user';

  if (role !== 'admin') {
    deniedEl.hidden = false;
    return;
  }

  contentEl.hidden = false;
  await loadUsers();
});

logoutBtn.addEventListener('click', async () => {
  await signOut(auth);
  window.location.href = 'index.html';
});

async function loadUsers() {
  try {
    const snapshot = await getDocs(query(collection(db, 'users'), orderBy('createdAt', 'desc')));
    const users = snapshot.docs.map((d) => d.data());

    statUsers.textContent = users.length;
    statAdmins.textContent = users.filter((u) => u.role === 'admin').length;

    if (users.length === 0) {
      usersTableBody.innerHTML = '<tr><td colspan="4" class="text-muted">No users found.</td></tr>';
      return;
    }

    usersTableBody.innerHTML = users
      .map(
        (u) => `
      <tr>
        <td>${escapeHtml(u.displayName || '—')}</td>
        <td>${escapeHtml(u.email || '—')}</td>
        <td><span class="role-badge ${u.role || 'user'}">${u.role || 'user'}</span></td>
        <td>${formatDate(u.createdAt)}</td>
      </tr>
    `
      )
      .join('');
  } catch (err) {
    usersTableBody.innerHTML =
      '<tr><td colspan="4" class="text-muted">Could not load users. Check Firestore rules.</td></tr>';
    console.error(err);
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
