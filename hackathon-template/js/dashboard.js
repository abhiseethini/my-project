/**
 * Campus Lost & Found — Dashboard application.
 */

import { requireAuth, logout } from './auth.js';
import { getUserProfile } from './userProfile.js';
import {
  CATEGORIES,
  subscribeToItems,
  createItem,
  updateItem,
  deleteItem,
  markItemResolved,
  filterItems,
  getStats,
  getRecentItems,
  getResolvedStories,
  getMyReports,
} from './items.js';
import { findPossibleMatches, findMatchesForItem } from './matching.js';
import {
  subscribeToNotifications,
  markNotificationRead,
  notifyContactRequest,
  notifyPossibleMatch,
} from './notifications.js';
import {
  showToast,
  openModal,
  closeModal,
  confirmAction,
  skeletonCards,
  emptyState,
  escapeHtml,
  formatDate,
  formatDateTime,
  initModalClosers,
  setBtnLoading,
} from './ui.js';

let currentUser = null;
let allItems = [];
let myReportsTab = 'all';
let reportType = 'lost';
const TOTAL_STEPS = 3;
let formStep = 1;
let imageFile = null;
let unsubscribeItems = null;
let unsubscribeNotifs = null;

const PLACEHOLDER_IMG = 'data:image/svg+xml,' + encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="240" viewBox="0 0 400 240"><rect fill="%23f1f5f9" width="400" height="240"/><text x="200" y="125" text-anchor="middle" fill="%2394a3b8" font-family="sans-serif" font-size="16">No Image</text></svg>'
);

requireAuth(async (user) => {
  currentUser = user;
  initUserUI(user);

  try {
    const profile = await getUserProfile(user.uid);
    if (profile?.name) {
      document.getElementById('welcome-name').textContent = profile.name;
      document.getElementById('profile-name-short').textContent = profile.name.split(' ')[0];
      document.getElementById('profile-dropdown-name').textContent = profile.name;
      document.getElementById('profile-avatar').textContent = profile.name.charAt(0).toUpperCase();
    }
    document.getElementById('report-contact-name').value = profile?.name || user.displayName || '';
  } catch (err) {
    console.error('Could not load user profile:', err.code, err.message, err);
    document.getElementById('report-contact-name').value = user.displayName || '';
  }

  document.getElementById('profile-dropdown-email').textContent = user.email || '—';
  document.getElementById('report-contact-email').value = user.email || '';

  showLoadingStates();
  unsubscribeItems = subscribeToItems(onItemsUpdate, (err) => {
    showToast('Could not load reports. Publish the latest Firestore rules.', 'error');
    console.error('Reports load failed:', err);
  });
  unsubscribeNotifs = subscribeToNotifications(user.uid, renderNotifications);
});

function initUserUI(user) {
  const initial = (user.displayName || user.email || 'U').charAt(0).toUpperCase();
  document.getElementById('profile-avatar').textContent = initial;
  document.getElementById('welcome-name').textContent = user.displayName || 'there';
  document.getElementById('profile-name-short').textContent = (user.displayName || 'User').split(' ')[0];
}

function showLoadingStates() {
  ['recent-grid', 'lost-reports-grid', 'found-reports-grid', 'my-reports-grid', 'matches-grid'].forEach((id) => {
    const el = document.getElementById(id);
    if (el) skeletonCards(3, el);
  });
}

function onItemsUpdate(items) {
  allItems = items;
  renderStats();
  renderCategories();
  renderRecent();
  renderLostReports();
  renderFoundReports();
  renderMatches();
  renderSuccessStories();
  renderMyReports();
  runSearch();
}

function renderStats() {
  const s = getStats(allItems, currentUser.uid);
  animateValue('stat-lost', s.totalLost);
  animateValue('stat-found', s.totalFound);
  animateValue('stat-returned', s.returned);
  animateValue('stat-mine', s.myReports);
}

function animateValue(id, target) {
  const el = document.getElementById(id);
  if (!el || el.textContent === '—') { el.textContent = target; return; }
  const from = parseInt(el.textContent, 10) || 0;
  const start = performance.now();
  const tick = (now) => {
    const p = Math.min((now - start) / 800, 1);
    el.textContent = Math.round(from + (target - from) * (1 - Math.pow(1 - p, 3)));
    if (p < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

function populateCategorySelects() {
  const catSelect = document.getElementById('report-category');
  const filterCat = document.getElementById('filter-category');
  if (!catSelect || !filterCat) return;

  const currentFilter = filterCat.value;
  const currentReport = catSelect.value;

  catSelect.innerHTML =
    '<option value="" disabled>Select a category</option>' +
    CATEGORIES.map((c) => `<option value="${escapeHtml(c.id)}">${escapeHtml(c.label)}</option>`).join('');

  filterCat.innerHTML =
    '<option value="all">All Categories</option>' +
    CATEGORIES.map((c) => `<option value="${escapeHtml(c.id)}">${escapeHtml(c.label)}</option>`).join('');

  if (currentFilter) filterCat.value = currentFilter;
  if (currentReport) catSelect.value = currentReport;
}

function renderCategoryGrid() {
  const grid = document.getElementById('categories-grid');
  if (!grid) return;

  grid.innerHTML = CATEGORIES.map(
    (c) => `<button type="button" class="category-chip" data-category="${escapeHtml(c.id)}">
      <span class="cat-icon">${c.icon}</span><span>${escapeHtml(c.label)}</span>
    </button>`
  ).join('');
}

function renderCategories() {
  renderCategoryGrid();
  populateCategorySelects();
}

function handleCategoryChipClick(categoryId) {
  const filterCat = document.getElementById('filter-category');
  const filterPanel = document.getElementById('filter-panel');
  const searchInput = document.getElementById('global-search');

  filterCat.value = categoryId;
  searchInput.value = '';
  filterPanel.hidden = false;

  document.querySelectorAll('.category-chip').forEach((chip) => {
    chip.classList.toggle('active', chip.dataset.category === categoryId);
  });

  runSearch();
  document.getElementById('search-section').scrollIntoView({ behavior: 'smooth' });
}

function renderItemCard(item, options = {}) {
  const { showActions = false, isOwner = false, searchHint = '' } = options;
  const badgeClass = item.type === 'lost' ? 'badge-lost' : 'badge-found';
  const statusClass = item.status === 'resolved' ? 'status-resolved' : 'status-active';
  const locationPrefix = item.type === 'lost' ? 'Lost at' : 'Found at';

  return `
    <article class="item-card reveal" data-id="${item.id}">
      <div class="item-img-wrap">
        <img src="${item.imageUrl || PLACEHOLDER_IMG}" alt="${escapeHtml(item.itemName)}" loading="lazy">
        <span class="item-badge ${badgeClass}">${item.type}</span>
      </div>
      <div class="item-body">
        <div class="item-meta">
          <span class="item-category">${escapeHtml(item.category)}</span>
          <span class="item-status ${statusClass}">${item.status}</span>
        </div>
        <h3 class="item-title">${escapeHtml(item.itemName)}</h3>
        ${searchHint ? `<p class="match-hint">${escapeHtml(searchHint)}</p>` : ''}
        <p class="item-desc">${escapeHtml((item.description || '').slice(0, 90))}${(item.description || '').length > 90 ? '…' : ''}</p>
        <div class="item-footer">
          <span class="item-loc">📍 ${locationPrefix}: ${escapeHtml(item.location || '—')}</span>
          <span class="item-date">${formatDate(item.dateTime || item.createdAt)}</span>
        </div>
        <div class="item-actions">
          <button type="button" class="btn btn-outline btn-sm view-btn" data-id="${item.id}">View Details</button>
          ${!isOwner && item.status === 'active' ? `<button type="button" class="btn btn-primary btn-sm contact-btn" data-id="${item.id}">${item.type === 'lost' ? 'I Found This' : 'Contact Reporter'}</button>` : ''}
          ${showActions && isOwner ? `
            <button type="button" class="btn btn-ghost btn-sm edit-btn" data-id="${item.id}">Edit</button>
            ${item.status === 'active' ? `<button type="button" class="btn btn-ghost btn-sm resolve-btn" data-id="${item.id}">Mark Resolved</button>` : ''}
            <button type="button" class="btn btn-danger btn-sm delete-btn" data-id="${item.id}">Delete</button>
          ` : ''}
        </div>
      </div>
    </article>`;
}

function bindCardActions(container) {
  container.querySelectorAll('.view-btn').forEach((b) => b.addEventListener('click', () => openDetails(b.dataset.id)));
  container.querySelectorAll('.contact-btn').forEach((b) => b.addEventListener('click', () => openContact(b.dataset.id)));
  container.querySelectorAll('.edit-btn').forEach((b) => b.addEventListener('click', () => openEditReport(b.dataset.id)));
  container.querySelectorAll('.resolve-btn').forEach((b) => b.addEventListener('click', () => handleResolve(b.dataset.id)));
  container.querySelectorAll('.delete-btn').forEach((b) => b.addEventListener('click', () => handleDelete(b.dataset.id)));
}

function renderRecent() {
  const grid = document.getElementById('recent-grid');
  const items = getRecentItems(allItems, 6);
  if (items.length === 0) {
    grid.innerHTML = emptyState({ icon: '📭', title: 'No items yet', message: 'Be the first to report a lost or found item.', actionLabel: 'Report Lost Item', actionId: 'empty-report-lost' });
    document.getElementById('empty-report-lost')?.addEventListener('click', () => openReportModal('lost'));
    return;
  }
  grid.innerHTML = items.map((i) => renderItemCard(i, { isOwner: i.reporterUid === currentUser.uid })).join('');
  bindCardActions(grid);
  observeReveal(grid);
}

function renderLostReports() {
  const grid = document.getElementById('lost-reports-grid');
  if (!grid) return;
  const items = allItems.filter((i) => i.type === 'lost' && i.status === 'active');
  if (items.length === 0) {
    grid.innerHTML = emptyState({ icon: '📋', title: 'No lost reports yet', message: 'There are currently no active lost items.' });
    return;
  }
  grid.innerHTML = items.map((i) => renderItemCard(i, { isOwner: i.reporterUid === currentUser.uid })).join('');
  bindCardActions(grid);
  observeReveal(grid);
}

function renderFoundReports() {
  const grid = document.getElementById('found-reports-grid');
  if (!grid) return;
  const items = allItems.filter((i) => i.type === 'found' && i.status === 'active');
  if (items.length === 0) {
    grid.innerHTML = emptyState({ icon: '🔍', title: 'No found reports yet', message: 'There are currently no active found items.' });
    return;
  }
  grid.innerHTML = items.map((i) => renderItemCard(i, { isOwner: i.reporterUid === currentUser.uid })).join('');
  bindCardActions(grid);
  observeReveal(grid);
}

function renderMyReports() {
  const grid = document.getElementById('my-reports-grid');
  const items = getMyReports(allItems, currentUser.uid, myReportsTab);
  if (items.length === 0) {
    grid.innerHTML = emptyState({ icon: '📋', title: 'No reports yet', message: 'Your lost and found reports will appear here.' });
    return;
  }
  grid.innerHTML = items.map((i) => renderItemCard(i, { showActions: true, isOwner: true })).join('');
  bindCardActions(grid);
  observeReveal(grid);
}

function renderMatches() {
  const grid = document.getElementById('matches-grid');
  const matches = findPossibleMatches(allItems);
  if (matches.length === 0) {
    grid.innerHTML = emptyState({ icon: '🔗', title: 'No matches yet', message: 'When lost and found reports align, possible matches appear here.' });
    return;
  }
  grid.innerHTML = matches.map((m) => `
    <article class="match-card reveal">
      <div class="match-score">${m.score}% match</div>
      <div class="match-pair">
        <div class="match-item"><span class="badge-lost">Lost</span><strong>${escapeHtml(m.lost.itemName)}</strong><small>${escapeHtml(m.lost.location)}</small></div>
        <div class="match-arrow">↔</div>
        <div class="match-item"><span class="badge-found">Found</span><strong>${escapeHtml(m.found.itemName)}</strong><small>${escapeHtml(m.found.location)}</small></div>
      </div>
      <div class="match-actions">
        <button type="button" class="btn btn-outline btn-sm view-btn" data-id="${m.lost.id}">View Lost</button>
        <button type="button" class="btn btn-outline btn-sm view-btn" data-id="${m.found.id}">View Found</button>
      </div>
    </article>`).join('');
  bindCardActions(grid);
  observeReveal(grid);
}

function renderSuccessStories() {
  const grid = document.getElementById('success-grid');
  const stories = getResolvedStories(allItems, 4);
  if (stories.length === 0) {
    grid.innerHTML = '<p class="text-muted center">No returned items yet — help create the first success story!</p>';
    return;
  }
  grid.innerHTML = stories.map((s) => `
    <article class="success-card reveal">
      <div class="success-icon">🎉</div>
      <h4>${escapeHtml(s.itemName)}</h4>
      <p class="text-muted">${s.type === 'lost' ? 'Lost' : 'Found'} · ${escapeHtml(s.category)}</p>
      <span class="success-date">Returned ${formatDate(s.updatedAt || s.createdAt)}</span>
    </article>`).join('');
  observeReveal(grid);
}

function getFilters() {
  return {
    search: document.getElementById('global-search').value,
    type: document.getElementById('filter-type').value,
    category: document.getElementById('filter-category').value,
    status: document.getElementById('filter-status').value,
    location: document.getElementById('filter-location').value,
    dateFrom: document.getElementById('filter-date').value,
  };
}

function searchHintFor(item) {
  if (item.type === 'lost') return 'Owner is looking for this item';
  return 'Possible match for a lost item';
}

function runSearch() {
  const query = document.getElementById('global-search').value.trim();
  const filters = getFilters();
  const hasFilter = query || filters.type !== 'all' || filters.category !== 'all' ||
    filters.status !== 'all' || filters.location || filters.dateFrom;

  const wrap = document.getElementById('search-results-wrap');
  if (!hasFilter) { wrap.hidden = true; return; }

  const results = filterItems(allItems, filters);
  document.getElementById('search-count').textContent = results.length;
  const grid = document.getElementById('search-results-grid');

  if (results.length === 0) {
    grid.innerHTML = emptyState({ icon: '🔍', title: 'No items found', message: 'Try different keywords. Search looks through both lost and found reports.' });
  } else {
    grid.innerHTML = results.map((i) => renderItemCard(i, {
      showActions: i.reporterUid === currentUser.uid,
      isOwner: i.reporterUid === currentUser.uid,
      searchHint: query ? searchHintFor(i) : '',
    })).join('');
    bindCardActions(grid);
  }
  wrap.hidden = false;
  observeReveal(grid);
}

function openDetails(itemId) {
  const item = allItems.find((i) => i.id === itemId);
  if (!item) return;
  const isOwner = item.reporterUid === currentUser.uid;
  const matches = findMatchesForItem(item, allItems);

  document.getElementById('details-content').innerHTML = `
    <div class="details-layout">
      <div class="details-img">
        <img src="${item.imageUrl || PLACEHOLDER_IMG}" alt="${escapeHtml(item.itemName)}">
        <span class="item-badge ${item.type === 'lost' ? 'badge-lost' : 'badge-found'}">${item.type}</span>
      </div>
      <div class="details-info">
        <h2>${escapeHtml(item.itemName)}</h2>
        <div class="details-tags">
          <span>${escapeHtml(item.category)}</span>
          <span class="item-status ${item.status === 'resolved' ? 'status-resolved' : 'status-active'}">${item.status}</span>
        </div>
        <p class="details-desc">${escapeHtml(item.description || '')}</p>
        <dl class="details-list">
          <dt>Location</dt><dd>${escapeHtml(item.location || '—')}</dd>
          <dt>Date</dt><dd>${formatDateTime(item.dateTime || item.createdAt)}</dd>
          ${item.color ? `<dt>Color</dt><dd>${escapeHtml(item.color)}</dd>` : ''}
          ${item.brand ? `<dt>Brand</dt><dd>${escapeHtml(item.brand)}</dd>` : ''}
          ${item.marks ? `<dt>Unique Marks</dt><dd>${escapeHtml(item.marks)}</dd>` : ''}
        </dl>
        ${matches.length ? `<div class="details-matches"><h4>Possible Matches</h4>${matches.slice(0, 3).map((m) =>
          `<div class="mini-match"><span class="match-pct">${m.score}%</span> ${escapeHtml(m.item.itemName)}</div>`).join('')}</div>` : ''}
        <div class="details-actions">
          ${!isOwner && item.status === 'active' ? `<button type="button" class="btn btn-primary contact-btn" data-id="${item.id}">Contact Reporter</button>` : ''}
          ${isOwner && item.status === 'active' ? `<button type="button" class="btn btn-outline resolve-btn" data-id="${item.id}">Mark Resolved</button>` : ''}
        </div>
      </div>
    </div>`;

  document.getElementById('details-content').querySelectorAll('.contact-btn').forEach((b) =>
    b.addEventListener('click', () => { closeModal('details-modal'); openContact(b.dataset.id); }));
  document.getElementById('details-content').querySelectorAll('.resolve-btn').forEach((b) =>
    b.addEventListener('click', () => { closeModal('details-modal'); handleResolve(b.dataset.id); }));

  openModal('details-modal');
}

function openContact(itemId) {
  document.getElementById('contact-item-id').value = itemId;
  document.getElementById('contact-message').value = '';
  document.getElementById('contact-reveal').hidden = true;
  openModal('contact-modal');
}

async function handleContactSubmit(e) {
  e.preventDefault();
  const itemId = document.getElementById('contact-item-id').value;
  const item = allItems.find((i) => i.id === itemId);
  if (!item) return;

  const btn = e.target.querySelector('[type=submit]');
  setBtnLoading(btn, true);

  try {
    await notifyContactRequest({
      item,
      fromUser: currentUser,
      message: document.getElementById('contact-message').value.trim(),
    });

    const reveal = document.getElementById('contact-reveal');
    reveal.hidden = false;
    reveal.innerHTML = `
      <div class="alert alert-success">Contact request sent!</div>
      <dl class="contact-list">
        <dt>Reporter</dt><dd>${escapeHtml(item.reporterName)}</dd>
        ${item.contactMethod !== 'phone' ? `<dt>Email</dt><dd><a href="mailto:${escapeHtml(item.reporterEmail)}">${escapeHtml(item.reporterEmail)}</a></dd>` : ''}
        ${item.reporterPhone && item.contactMethod !== 'email' ? `<dt>Phone</dt><dd>${escapeHtml(item.reporterPhone)}</dd>` : ''}
      </dl>`;

    showToast('Contact request sent successfully!', 'success');
  } catch (err) {
    console.error(err);
    showToast('Failed to send contact request.', 'error');
  } finally {
    setBtnLoading(btn, false, 'Send Contact Request');
  }
}

function renderNotifications(notifications) {
  const unread = notifications.filter((n) => !n.read).length;
  const badge = document.getElementById('notif-badge');
  badge.textContent = unread;
  badge.hidden = unread === 0;

  const list = document.getElementById('notif-list');
  if (notifications.length === 0) {
    list.innerHTML = '<p class="notif-empty">No notifications yet</p>';
    return;
  }
  list.innerHTML = notifications.slice(0, 10).map((n) => `
    <button type="button" class="notif-item ${n.read ? '' : 'unread'}" data-id="${n.id}">
      <span class="notif-type">${n.type === 'match' ? '🔗' : n.type === 'contact' ? '💬' : 'ℹ'}</span>
      <span>${escapeHtml(n.message)}</span>
    </button>`).join('');

  list.querySelectorAll('.notif-item').forEach((btn) => {
    btn.addEventListener('click', async () => {
      await markNotificationRead(btn.dataset.id);
    });
  });
}

// ── Report Form (multi-step) ──

function openReportModal(type) {
  reportType = type;
  formStep = 1;
  imageFile = null;
  populateCategorySelects();
  document.getElementById('edit-item-id').value = '';
  document.getElementById('report-type').value = type;
  document.getElementById('report-form').reset();
  document.getElementById('report-category').value = '';
  document.getElementById('image-preview').hidden = true;
  document.getElementById('report-modal-title').textContent = type === 'lost' ? 'Report Lost Item' : 'Report Found Item';
  document.getElementById('report-type-label').textContent = type === 'lost' ? 'Lost Report' : 'Found Report';
  document.getElementById('report-location-label').textContent = type === 'lost' ? 'Last Seen Location *' : 'Found Location *';
  document.getElementById('report-contact-name').value = currentUser.displayName || '';
  document.getElementById('report-contact-email').value = currentUser.email || '';
  setFormStep(1);
  openModal('report-modal');
}

function openEditReport(itemId) {
  const item = allItems.find((i) => i.id === itemId);
  if (!item) return;
  reportType = item.type;
  formStep = 1;
  imageFile = null;
  populateCategorySelects();
  document.getElementById('edit-item-id').value = itemId;
  document.getElementById('report-type').value = item.type;
  document.getElementById('report-item-name').value = item.itemName;
  document.getElementById('report-category').value = item.category;
  document.getElementById('report-description').value = item.description || '';
  document.getElementById('report-location').value = item.location || '';
  document.getElementById('report-color').value = item.color || '';
  document.getElementById('report-brand').value = item.brand || '';
  document.getElementById('report-marks').value = item.marks || '';
  document.getElementById('report-contact-name').value = item.reporterName || '';
  document.getElementById('report-contact-email').value = item.reporterEmail || '';
  document.getElementById('report-contact-phone').value = item.reporterPhone || '';
  document.getElementById('report-contact-method').value = item.contactMethod || 'email';
  if (item.dateTime) {
    const raw = item.dateTime;
    if (typeof raw === 'string' && raw.length >= 16) {
      document.getElementById('report-datetime').value = raw.slice(0, 16);
    } else {
      const d = raw.toDate ? raw.toDate() : new Date(raw);
      if (!Number.isNaN(d.getTime())) {
        const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
        document.getElementById('report-datetime').value = local.toISOString().slice(0, 16);
      }
    }
  }
  if (item.imageUrl) {
    const preview = document.getElementById('image-preview');
    preview.src = item.imageUrl;
    preview.hidden = false;
  }
  document.getElementById('report-modal-title').textContent = 'Edit Report';
  setFormStep(1);
  openModal('report-modal');
}

function setFormStep(step) {
  formStep = Math.min(TOTAL_STEPS, Math.max(1, step));
  updateFormStep();
}

function updateFormStep() {
  formStep = Math.min(TOTAL_STEPS, Math.max(1, formStep));

  document.querySelectorAll('.form-step').forEach((s) => {
    s.classList.toggle('active', parseInt(s.dataset.step, 10) === formStep);
  });

  const progress = document.getElementById('form-progress-fill');
  const progressText = document.getElementById('form-progress-text');
  const prevBtn = document.getElementById('form-prev-btn');
  const nextBtn = document.getElementById('form-next-btn');
  const submitBtn = document.getElementById('form-submit-btn');

  if (progress) progress.style.width = `${(formStep / TOTAL_STEPS) * 100}%`;
  if (progressText) progressText.textContent = `Step ${formStep} of ${TOTAL_STEPS}`;

  const onLast = formStep >= TOTAL_STEPS;
  const onFirst = formStep <= 1;

  if (prevBtn) {
    prevBtn.hidden = onFirst;
    prevBtn.classList.toggle('is-hidden', onFirst);
  }
  if (nextBtn) {
    nextBtn.hidden = onLast;
    nextBtn.classList.toggle('is-hidden', onLast);
    nextBtn.disabled = onLast;
  }
  if (submitBtn) {
    submitBtn.hidden = !onLast;
    submitBtn.classList.toggle('is-hidden', !onLast);
  }
}

function validateStep(step) {
  if (step === 1) {
    if (!document.getElementById('report-item-name').value.trim()) { showToast('Item name is required.', 'error'); return false; }
    if (!document.getElementById('report-category').value) { showToast('Category is required.', 'error'); return false; }
    if (!document.getElementById('report-description').value.trim()) { showToast('Description is required.', 'error'); return false; }
  }
  if (step === 2) {
    if (!document.getElementById('report-location').value.trim()) { showToast('Location is required.', 'error'); return false; }
    if (!document.getElementById('report-datetime').value) { showToast('Date & time is required.', 'error'); return false; }
  }
  if (step === 3) {
    if (!document.getElementById('report-contact-name').value.trim()) { showToast('Name is required.', 'error'); return false; }
    const email = document.getElementById('report-contact-email').value.trim();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { showToast('Valid email is required.', 'error'); return false; }
  }
  return true;
}

function collectFormData() {
  return {
    type: reportType,
    itemName: document.getElementById('report-item-name').value.trim(),
    category: document.getElementById('report-category').value,
    description: document.getElementById('report-description').value.trim(),
    location: document.getElementById('report-location').value.trim(),
    dateTime: document.getElementById('report-datetime').value,
    color: document.getElementById('report-color').value.trim(),
    brand: document.getElementById('report-brand').value.trim(),
    marks: document.getElementById('report-marks').value.trim(),
    reporterName: document.getElementById('report-contact-name').value.trim(),
    reporterEmail: document.getElementById('report-contact-email').value.trim(),
    reporterPhone: document.getElementById('report-contact-phone').value.trim(),
    contactMethod: document.getElementById('report-contact-method').value,
  };
}

async function handleReportSubmit(e) {
  e.preventDefault();
  e.stopPropagation();

  if (formStep < TOTAL_STEPS) {
    if (!validateStep(formStep)) return;
    setFormStep(formStep + 1);
    return;
  }

  if (!validateStep(1) || !validateStep(2) || !validateStep(3)) {
    if (!validateStep(1)) setFormStep(1);
    else if (!validateStep(2)) setFormStep(2);
    return;
  }

  if (!currentUser) {
    showToast('Please sign in again to submit a report.', 'error');
    return;
  }

  const btn = document.getElementById('form-submit-btn');
  setBtnLoading(btn, true);
  const data = collectFormData();
  const editId = document.getElementById('edit-item-id').value;

  try {
    if (editId) {
      const existing = allItems.find((i) => i.id === editId);
      if (!existing) throw new Error('Report not found.');
      await updateItem(existing, data, imageFile, currentUser.uid);
      showToast('Report updated successfully!', 'success');
    } else {
      const result = await createItem(currentUser.uid, data, imageFile);
      if (result.imageWarning) {
        showToast('Report saved, but the image could not be uploaded. Check Storage rules.', 'error');
      } else {
        showToast(`${reportType === 'lost' ? 'Lost' : 'Found'} item reported successfully!`, 'success');
      }

      const saved = result.item;
      const matches = findMatchesForItem(saved, [...allItems, saved]);
      await notifyMatchesAfterSave(saved, matches);
      if (matches.length) {
        showToast(`${matches.length} possible match${matches.length === 1 ? '' : 'es'} found.`, 'info');
      }
    }

    closeModal('report-modal');
    document.getElementById('my-reports-section')?.scrollIntoView({ behavior: 'smooth' });
  } catch (err) {
    console.error('Report submit error:', err.code, err.message, err);
    const message = submitErrorMessage(err);
    showToast(message, 'error');
  } finally {
    setBtnLoading(btn, false, 'Submit Report');
  }
}

function submitErrorMessage(err) {
  if (err.code === 'permission-denied') {
    return 'Permission denied. Publish the latest Firestore (and Storage) rules, then try again.';
  }
  if (err.code === 'unavailable') {
    return 'Could not reach Firebase. Check your connection and try again.';
  }
  return err.message || 'Failed to submit report.';
}

async function notifyMatchesAfterSave(saved, matches) {
  for (const match of matches.slice(0, 5)) {
    try {
      const lost = saved.type === 'lost' ? saved : match.item;
      const found = saved.type === 'found' ? saved : match.item;
      const otherUid = match.item.reporterUid || match.item.userId;
      if (otherUid && otherUid !== currentUser.uid) {
        await notifyPossibleMatch(lost, found, otherUid, currentUser.uid);
      }
    } catch (err) {
      console.error('Match notification failed:', err.code, err.message, err);
    }
  }
}

async function handleResolve(itemId) {
  const item = allItems.find((i) => i.id === itemId);
  if (!item) return;
  const ok = await confirmAction({ title: 'Mark as Resolved?', message: 'This item will be moved to resolved/success stories.', confirmText: 'Mark Resolved' });
  if (!ok) return;
  try {
    await markItemResolved(item);
    showToast('Item marked as resolved!', 'success');
  } catch (err) {
    console.error('Resolve failed:', err);
    showToast('Failed to update item.', 'error');
  }
}

async function handleDelete(itemId) {
  const item = allItems.find((i) => i.id === itemId);
  if (!item) return;
  const ok = await confirmAction({ title: 'Delete Report?', message: 'This action cannot be undone.', confirmText: 'Delete', danger: true });
  if (!ok) return;
  try {
    await deleteItem(item);
    showToast('Report deleted.', 'success');
  } catch (err) {
    console.error('Delete failed:', err);
    showToast('Failed to delete report.', 'error');
  }
}

function observeReveal(container) {
  container?.querySelectorAll('.reveal').forEach((el, i) => {
    el.style.animationDelay = `${i * 0.06}s`;
    el.classList.add('visible');
  });
}

function initScrollReveal() {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((e) => { if (e.isIntersecting) e.target.classList.add('visible'); });
  }, { threshold: 0.08 });
  document.querySelectorAll('.reveal').forEach((el) => observer.observe(el));
}

// ── Event Listeners ──

document.getElementById('logout-btn').addEventListener('click', () => logout('index.html'));
document.getElementById('btn-report-lost').addEventListener('click', () => openReportModal('lost'));
document.getElementById('btn-report-found').addEventListener('click', () => openReportModal('found'));
document.getElementById('search-submit-btn').addEventListener('click', runSearch);
document.getElementById('global-search').addEventListener('input', runSearch);
document.getElementById('filter-toggle-btn').addEventListener('click', () => {
  document.getElementById('filter-panel').hidden = !document.getElementById('filter-panel').hidden;
});
document.getElementById('clear-filters-btn').addEventListener('click', () => {
  document.getElementById('filter-type').value = 'all';
  document.getElementById('filter-category').value = 'all';
  document.getElementById('filter-status').value = 'all';
  document.getElementById('filter-location').value = '';
  document.getElementById('filter-date').value = '';
  document.querySelectorAll('.category-chip').forEach((chip) => chip.classList.remove('active'));
  runSearch();
});

document.getElementById('categories-grid').addEventListener('click', (e) => {
  const chip = e.target.closest('.category-chip');
  if (!chip) return;
  handleCategoryChipClick(chip.dataset.category);
});

document.getElementById('filter-category').addEventListener('change', () => {
  const value = document.getElementById('filter-category').value;
  document.querySelectorAll('.category-chip').forEach((chip) => {
    chip.classList.toggle('active', value !== 'all' && chip.dataset.category === value);
  });
  runSearch();
});
document.getElementById('form-next-btn').addEventListener('click', (e) => {
  e.preventDefault();
  e.stopPropagation();
  if (formStep >= TOTAL_STEPS) {
    setFormStep(TOTAL_STEPS);
    return;
  }
  if (!validateStep(formStep)) return;
  setFormStep(formStep + 1);
});
document.getElementById('form-prev-btn').addEventListener('click', (e) => {
  e.preventDefault();
  setFormStep(formStep - 1);
});
document.getElementById('report-form').addEventListener('submit', handleReportSubmit);
document.getElementById('contact-form').addEventListener('submit', handleContactSubmit);

document.getElementById('report-description').addEventListener('input', (e) => {
  document.getElementById('desc-count').textContent = e.target.value.length;
});

document.getElementById('upload-trigger').addEventListener('click', () => document.getElementById('report-image').click());
document.getElementById('report-image').addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;
  imageFile = file;
  const preview = document.getElementById('image-preview');
  preview.src = URL.createObjectURL(file);
  preview.hidden = false;
});

document.querySelectorAll('.tab').forEach((tab) => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach((t) => t.classList.remove('active'));
    tab.classList.add('active');
    myReportsTab = tab.dataset.tab;
    renderMyReports();
  });
});

document.querySelectorAll('[data-scroll]').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.getElementById(btn.dataset.scroll)?.scrollIntoView({ behavior: 'smooth' });
    document.getElementById('profile-dropdown').hidden = true;
    document.getElementById('header-nav').classList.remove('open');
  });
});

document.getElementById('profile-btn').addEventListener('click', () => {
  const dd = document.getElementById('profile-dropdown');
  dd.hidden = !dd.hidden;
  document.getElementById('notif-dropdown').hidden = true;
});

document.getElementById('notif-btn').addEventListener('click', () => {
  const dd = document.getElementById('notif-dropdown');
  dd.hidden = !dd.hidden;
  document.getElementById('profile-dropdown').hidden = true;
});

document.getElementById('search-toggle-btn').addEventListener('click', () => {
  document.getElementById('search-section').scrollIntoView({ behavior: 'smooth' });
  document.getElementById('global-search').focus();
});

document.getElementById('mobile-menu-btn').addEventListener('click', () => {
  document.getElementById('header-nav').classList.toggle('open');
});

document.addEventListener('click', (e) => {
  if (!e.target.closest('.profile-wrap')) document.getElementById('profile-dropdown').hidden = true;
  if (!e.target.closest('.notif-wrap')) document.getElementById('notif-dropdown').hidden = true;
});

initModalClosers();
initScrollReveal();
renderCategoryGrid();
populateCategorySelects();
