/**
 * Shared UI utilities — toasts, modals, skeletons, confirmations.
 */

const toastContainer = () => {
  let el = document.getElementById('toast-container');
  if (!el) {
    el = document.createElement('div');
    el.id = 'toast-container';
    el.className = 'toast-container';
    el.setAttribute('aria-live', 'polite');
    document.body.appendChild(el);
  }
  return el;
};

export function showToast(message, type = 'success', duration = 4000) {
  const container = toastContainer();
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `
    <span class="toast-icon">${type === 'success' ? '✓' : type === 'error' ? '✕' : 'ℹ'}</span>
    <span class="toast-msg">${escapeHtml(message)}</span>
  `;
  container.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add('show'));
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

export function openModal(id) {
  const modal = document.getElementById(id);
  if (!modal) return;
  modal.hidden = false;
  modal.setAttribute('aria-hidden', 'false');
  document.body.classList.add('modal-open');
  requestAnimationFrame(() => modal.classList.add('active'));
  const focusable = modal.querySelector('input, button, select, textarea');
  if (focusable) focusable.focus();
}

export function closeModal(id) {
  const modal = document.getElementById(id);
  if (!modal) return;
  modal.classList.remove('active');
  setTimeout(() => {
    modal.hidden = true;
    modal.setAttribute('aria-hidden', 'true');
    if (!document.querySelector('.app-modal.active')) {
      document.body.classList.remove('modal-open');
    }
  }, 250);
}

export function closeAllModals() {
  document.querySelectorAll('.app-modal.active').forEach((m) => {
    closeModal(m.id);
  });
}

export function confirmAction({ title, message, confirmText = 'Confirm', danger = false }) {
  return new Promise((resolve) => {
    const modal = document.getElementById('confirm-modal');
    if (!modal) { resolve(false); return; }

    document.getElementById('confirm-title').textContent = title;
    document.getElementById('confirm-message').textContent = message;
    const btn = document.getElementById('confirm-action-btn');
    btn.textContent = confirmText;
    btn.className = danger ? 'btn btn-danger' : 'btn btn-primary';

    const cleanup = () => {
      btn.removeEventListener('click', onConfirm);
      document.getElementById('confirm-cancel-btn').removeEventListener('click', onCancel);
      closeModal('confirm-modal');
    };
    const onConfirm = () => { cleanup(); resolve(true); };
    const onCancel = () => { cleanup(); resolve(false); };

    btn.addEventListener('click', onConfirm);
    document.getElementById('confirm-cancel-btn').addEventListener('click', onCancel);
    openModal('confirm-modal');
  });
}

export function skeletonCards(count, container) {
  container.innerHTML = Array.from({ length: count }, () =>
    `<article class="item-card skeleton-card">
      <div class="skeleton skeleton-img"></div>
      <div class="skeleton skeleton-text"></div>
      <div class="skeleton skeleton-text short"></div>
    </article>`
  ).join('');
}

export function emptyState({ icon, title, message, actionLabel, actionId }) {
  return `
    <div class="empty-state">
      <div class="empty-icon">${icon}</div>
      <h3>${escapeHtml(title)}</h3>
      <p>${escapeHtml(message)}</p>
      ${actionLabel ? `<button type="button" class="btn btn-primary" id="${actionId}">${escapeHtml(actionLabel)}</button>` : ''}
    </div>`;
}

export function escapeHtml(str) {
  if (str == null) return '';
  const div = document.createElement('div');
  div.textContent = String(str);
  return div.innerHTML;
}

export function formatDate(value) {
  if (!value) return '—';
  const date = value.toDate ? value.toDate() : new Date(value);
  return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

export function formatDateTime(value) {
  if (!value) return '—';
  const date = value.toDate ? value.toDate() : new Date(value);
  return date.toLocaleString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function initModalClosers() {
  document.querySelectorAll('[data-close-modal]').forEach((el) => {
    el.addEventListener('click', () => closeModal(el.dataset.closeModal));
  });
  document.querySelectorAll('.app-modal').forEach((modal) => {
    modal.addEventListener('click', (e) => {
      if (e.target === modal || e.target.classList.contains('modal-backdrop')) {
        closeModal(modal.id);
      }
    });
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeAllModals();
  });
}

export function setBtnLoading(btn, loading, originalText) {
  if (!btn) return;
  btn.disabled = loading;
  if (loading) {
    btn.dataset.original = btn.textContent;
    btn.innerHTML = '<span class="spinner"></span> Please wait…';
  } else {
    btn.textContent = originalText || btn.dataset.original || btn.textContent;
  }
}
