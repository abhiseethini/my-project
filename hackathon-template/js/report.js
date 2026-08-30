/**
 * Report Details Page — fetches a single report from Firestore and renders it.
 */

import { requireAuth } from './auth.js';
import { db } from './firebase.js';
import { doc, getDoc } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
import { normalizeReport, LOST_COLLECTION, FOUND_COLLECTION } from './items.js';

const PLACEHOLDER_IMG = 'data:image/svg+xml,' + encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="800" height="380" viewBox="0 0 800 380"><rect fill="#f1f5f9" width="800" height="380"/><text x="400" y="200" text-anchor="middle" fill="#94a3b8" font-family="Inter,sans-serif" font-size="18">No Image Available</text></svg>'
);

function escapeHtml(str) {
  if (str == null) return '';
  const div = document.createElement('div');
  div.textContent = String(str);
  return div.innerHTML;
}

function formatDate(value) {
  if (!value) return '—';
  const date = value.toDate ? value.toDate() : new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
}

function formatDateTime(value) {
  if (!value) return '—';
  const date = value.toDate ? value.toDate() : new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString(undefined, {
    weekday: 'short', year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

requireAuth(async (user) => {
  const params = new URLSearchParams(window.location.search);
  const reportId = params.get('id');
  const typeHint = params.get('type') || 'lost';

  const loadingEl = document.getElementById('report-loading');
  const errorEl = document.getElementById('report-error');
  const contentEl = document.getElementById('report-content');

  if (!reportId) {
    showError('No report ID was provided in the URL.');
    return;
  }

  try {
    let docSnap = null;
    let collectionName = typeHint === 'found' ? FOUND_COLLECTION : LOST_COLLECTION;

    // Try primary collection based on type hint
    docSnap = await getDoc(doc(db, collectionName, reportId));

    // Fallback: try the other collection
    if (!docSnap.exists()) {
      const otherCol = collectionName === FOUND_COLLECTION ? LOST_COLLECTION : FOUND_COLLECTION;
      docSnap = await getDoc(doc(db, otherCol, reportId));
      if (docSnap.exists()) collectionName = otherCol;
    }

    // Fallback: try legacy 'items' collection
    if (!docSnap.exists()) {
      collectionName = 'items';
      docSnap = await getDoc(doc(db, 'items', reportId));
    }

    if (!docSnap.exists()) {
      showError('This report could not be found. It may have been deleted.');
      return;
    }

    const item = normalizeReport(docSnap.id, docSnap.data(), typeHint, collectionName);
    renderReport(item, user);

    // Show success toast if redirected from submission
    if (params.get('new') === '1') {
      showSuccessToast();
    }

  } catch (err) {
    console.error('Error loading report:', err.code, err.message, err);
    if (err.code === 'permission-denied') {
      showError('Permission denied. Please make sure Firestore rules are published.');
    } else {
      showError('Failed to load report details. Please try again.');
    }
  }

  function showError(message) {
    loadingEl.hidden = true;
    contentEl.hidden = true;
    errorEl.hidden = false;
    const msgEl = document.getElementById('error-message');
    if (msgEl) msgEl.textContent = message;
  }

  function showSuccessToast() {
    const toast = document.getElementById('success-toast');
    if (!toast) return;
    toast.hidden = false;
    setTimeout(() => {
      toast.classList.add('hide');
      setTimeout(() => { toast.hidden = true; }, 500);
    }, 4000);
  }

  function renderReport(item, currentUser) {
    loadingEl.hidden = true;
    contentEl.hidden = false;

    const isOwner = currentUser && (currentUser.uid === item.reporterUid || currentUser.uid === item.userId);
    const imageUrl = item.imageUrl || PLACEHOLDER_IMG;
    const isLost = item.type === 'lost';
    const badgeClass = isLost ? 'rpt-badge-lost' : 'rpt-badge-found';
    const badgeText = isLost ? 'LOST' : 'FOUND';
    const initial = (item.reporterName || 'A').charAt(0).toUpperCase();

    // Build detail items (only show non-empty fields)
    const detailFields = [
      { label: 'Location', value: item.location, icon: '📍' },
      { label: 'Date & Time', value: formatDateTime(item.dateTime), icon: '📅' },
      { label: 'Color', value: item.color, icon: '🎨' },
      { label: 'Brand', value: item.brand, icon: '🏷️' },
      { label: 'Unique Marks', value: item.marks, icon: '✨' },
    ].filter(d => d.value && d.value !== '—');

    const detailsGridHtml = detailFields.length > 0
      ? `<div class="rpt-details">
           ${detailFields.map(d => `
             <div class="rpt-detail">
               <span class="rpt-detail-label">${d.icon} ${escapeHtml(d.label)}</span>
               <span class="rpt-detail-value">${escapeHtml(d.value)}</span>
             </div>`).join('')}
         </div>`
      : '';

    // Update page title
    document.title = `${escapeHtml(item.itemName)} — Campus Lost & Found`;

    contentEl.innerHTML = `
      <div class="rpt-card">
        <div class="rpt-hero">
          <img src="${imageUrl}" alt="${escapeHtml(item.itemName)}" onerror="this.src='${PLACEHOLDER_IMG}'">
          <span class="rpt-badge ${badgeClass}">${badgeText}</span>
        </div>
        <div class="rpt-body">
          <h2 class="rpt-title">${escapeHtml(item.itemName)}</h2>

          <div class="rpt-chips">
            ${item.category ? `<span class="rpt-chip">📂 ${escapeHtml(item.category)}</span>` : ''}
            <span class="rpt-chip rpt-chip-status ${item.status === 'resolved' ? 'resolved' : ''}">${escapeHtml(item.status)}</span>
            <span class="rpt-chip">🕐 ${formatDate(item.createdAt)}</span>
          </div>

          <p class="rpt-desc">${escapeHtml(item.description || 'No description provided.')}</p>

          ${detailsGridHtml}

          <div class="rpt-reporter">
            <div class="rpt-reporter-avatar">${initial}</div>
            <div class="rpt-reporter-info">
              <div class="rpt-reporter-label">Reported by</div>
              <div class="rpt-reporter-name">${escapeHtml(item.reporterName || 'Anonymous')}</div>
            </div>
          </div>

          <div class="rpt-actions">
            <a href="dashboard.html" class="btn-action btn-action-outline">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="m15 18-6-6 6-6"/></svg>
              Back to Dashboard
            </a>
            ${!isOwner && item.status === 'active' ? `
              <a href="dashboard.html#search-section" class="btn-action btn-action-primary">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                Contact Reporter
              </a>` : ''}
          </div>
        </div>
      </div>`;
  }
});
