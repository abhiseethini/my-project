/**
 * Firestore + Storage operations for lost & found reports.
 * Collections: lostReports, foundReports (legacy: items).
 */

import { db, storage } from './firebase.js';
import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
  serverTimestamp,
  onSnapshot,
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
import { ref, uploadBytes, getDownloadURL } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-storage.js';

export const LOST_COLLECTION = 'lostReports';
export const FOUND_COLLECTION = 'foundReports';
export const LEGACY_COLLECTION = 'items';

export const CATEGORIES = [
  { id: 'Electronics', icon: '📱', label: 'Electronics' },
  { id: 'ID Cards', icon: '🪪', label: 'ID Cards' },
  { id: 'Wallets', icon: '👛', label: 'Wallets' },
  { id: 'Keys', icon: '🔑', label: 'Keys' },
  { id: 'Bags', icon: '🎒', label: 'Bags' },
  { id: 'Books', icon: '📚', label: 'Books' },
  { id: 'Clothing', icon: '👕', label: 'Clothing' },
  { id: 'Accessories', icon: '⌚', label: 'Accessories' },
  { id: 'Other', icon: '📦', label: 'Other' },
];

function collectionForType(type) {
  return type === 'found' ? FOUND_COLLECTION : LOST_COLLECTION;
}

function createdAtMs(item) {
  const value = item.createdAt;
  if (!value) return 0;
  if (value.toMillis) return value.toMillis();
  const date = value.toDate ? value.toDate() : new Date(value);
  return date.getTime() || 0;
}

function stripUndefined(obj) {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined));
}

/** Maps Firestore documents from any collection into the dashboard item shape. */
export function normalizeReport(id, data, fallbackType, collectionName) {
  const type = data.reportType || data.type || fallbackType || 'lost';
  const userId = data.userId || data.reporterUid || '';

  return {
    id,
    collection: collectionName || collectionForType(type),
    type,
    itemName: data.itemName || '',
    category: data.category || '',
    description: data.description || '',
    imageUrl: data.imageUrl || null,
    location: data.location || '',
    dateTime: data.date || data.dateTime || null,
    color: data.color || '',
    brand: data.brand || '',
    marks: data.identificationMarks || data.marks || '',
    reporterName: data.ownerName || data.finderName || data.reporterName || '',
    reporterEmail: data.ownerEmail || data.finderEmail || data.reporterEmail || '',
    reporterPhone: data.ownerPhone || data.finderPhone || data.reporterPhone || '',
    contactMethod: data.preferredContactMethod || data.contactMethod || 'email',
    reporterUid: userId,
    userId,
    status: data.status || 'active',
    createdAt: data.createdAt || null,
    updatedAt: data.updatedAt || data.createdAt || null,
  };
}

function buildWritePayload(uid, data, imageUrl) {
  const type = data.type === 'found' ? 'found' : 'lost';
  const isLost = type === 'lost';
  const contactName = data.reporterName || '';
  const contactEmail = data.reporterEmail || '';
  const contactPhone = data.reporterPhone || '';

  return stripUndefined({
    itemName: data.itemName || '',
    category: data.category || '',
    description: data.description || '',
    imageUrl: imageUrl || data.imageUrl || '',
    location: data.location || '',
    date: data.dateTime || data.date || '',
    color: data.color || '',
    brand: data.brand || '',
    identificationMarks: data.marks || data.identificationMarks || '',
    ownerName: isLost ? contactName : '',
    ownerEmail: isLost ? contactEmail : '',
    ownerPhone: isLost ? contactPhone : '',
    finderName: isLost ? '' : contactName,
    finderEmail: isLost ? '' : contactEmail,
    finderPhone: isLost ? '' : contactPhone,
    preferredContactMethod: data.contactMethod || 'email',
    reportType: type,
    type,
    status: data.status || 'active',
    userId: uid,
    reporterUid: uid,
    createdAt: data.createdAt || serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

function listenCollection(name, fallbackType, bucket, emit, onError) {
  const q = query(collection(db, name), orderBy('createdAt', 'desc'));
  return onSnapshot(
    q,
    (snapshot) => {
      bucket.length = 0;
      snapshot.docs.forEach((d) => {
        bucket.push(normalizeReport(d.id, d.data(), fallbackType, name));
      });
      emit();
    },
    (err) => {
      console.error(`${name} subscription error:`, err.code, err.message, err);
      if (onError) onError(err);
    }
  );
}

export function subscribeToItems(callback, onError) {
  const lost = [];
  const found = [];
  const legacy = [];

  const emit = () => {
    const merged = [...lost, ...found, ...legacy].sort((a, b) => createdAtMs(b) - createdAtMs(a));
    callback(merged);
  };

  const unsubLost = listenCollection(LOST_COLLECTION, 'lost', lost, emit, onError);
  const unsubFound = listenCollection(FOUND_COLLECTION, 'found', found, emit, onError);
  const unsubLegacy = listenCollection(LEGACY_COLLECTION, 'lost', legacy, () => emit(), (err) => {
    console.warn('Legacy items collection not readable:', err.code);
  });

  return () => {
    unsubLost();
    unsubFound();
    unsubLegacy();
  };
}

export async function uploadItemImage(uid, file) {
  const itemId = (crypto.randomUUID && crypto.randomUUID()) || `${Date.now()}`;
  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
  const storageRef = ref(storage, `items/${uid}/${itemId}/photo.${ext}`);
  await uploadBytes(storageRef, file);
  return getDownloadURL(storageRef);
}

export async function createItem(uid, data, imageFile) {
  if (!uid) {
    throw new Error('You must be signed in to submit a report.');
  }

  let imageUrl = '';
  let imageWarning = null;

  if (imageFile) {
    try {
      imageUrl = await uploadItemImage(uid, imageFile);
    } catch (err) {
      console.error('Image upload failed; saving report without image:', err.code, err.message, err);
      imageWarning = err;
    }
  }

  const type = data.type === 'found' ? 'found' : 'lost';
  const payload = buildWritePayload(uid, { ...data, type }, imageUrl);
  payload.createdAt = serverTimestamp();

  const colName = collectionForType(type);
  const docRef = await addDoc(collection(db, colName), payload);
  console.log(`Report saved at ${colName}/${docRef.id}`);

  return {
    id: docRef.id,
    collection: colName,
    imageWarning,
    item: normalizeReport(docRef.id, { ...payload, createdAt: new Date() }, type, colName),
  };
}

export async function updateItem(item, data, imageFile, uid) {
  const collectionName = item.collection || collectionForType(item.type);
  const updates = buildWritePayload(uid, { ...item, ...data, type: item.type || data.type }, item.imageUrl);
  delete updates.createdAt;

  if (imageFile) {
    updates.imageUrl = await uploadItemImage(uid, imageFile);
  }

  await updateDoc(doc(db, collectionName, item.id), updates);
}

export async function deleteItem(item) {
  const collectionName = item.collection || collectionForType(item.type);
  await deleteDoc(doc(db, collectionName, item.id));
}

export async function markItemResolved(item) {
  const collectionName = item.collection || collectionForType(item.type);
  await updateDoc(doc(db, collectionName, item.id), {
    status: 'resolved',
    updatedAt: serverTimestamp(),
  });
}

export function filterItems(items, filters) {
  const { search, type, category, location, status, dateFrom } = filters;
  const terms = (search || '').toLowerCase().trim().split(/\s+/).filter(Boolean);
  const hasQuery = terms.length > 0;

  return items.filter((item) => {
    // Keyword search always includes both lost and found reports.
    if (!hasQuery && type && type !== 'all' && item.type !== type) return false;
    if (category && category !== 'all' && item.category !== category) return false;
    if (status && status !== 'all' && item.status !== status) return false;
    if (location && !item.location?.toLowerCase().includes(location.toLowerCase())) return false;

    if (dateFrom) {
      const itemDate = item.dateTime?.toDate?.() || new Date(item.dateTime);
      if (!Number.isNaN(itemDate.getTime()) && itemDate < new Date(dateFrom)) return false;
    }

    if (!hasQuery) return true;

    const haystack = [
      item.itemName,
      item.category,
      item.description,
      item.location,
      item.color,
      item.brand,
      item.marks,
      item.type,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();

    return terms.every((t) => haystack.includes(t));
  });
}

export function getStats(items, uid) {
  return {
    totalLost: items.filter((i) => i.type === 'lost' && i.status === 'active').length,
    totalFound: items.filter((i) => i.type === 'found' && i.status === 'active').length,
    returned: items.filter((i) => i.status === 'resolved').length,
    myReports: items.filter((i) => i.reporterUid === uid || i.userId === uid).length,
  };
}

export function getRecentItems(items, limit = 6) {
  return items.filter((i) => i.status === 'active').slice(0, limit);
}

export function getResolvedStories(items, limit = 4) {
  return items.filter((i) => i.status === 'resolved').slice(0, limit);
}

export function getMyReports(items, uid, tab = 'all') {
  const mine = items.filter((i) => i.reporterUid === uid || i.userId === uid);
  if (tab === 'lost') return mine.filter((i) => i.type === 'lost');
  if (tab === 'found') return mine.filter((i) => i.type === 'found');
  if (tab === 'resolved') return mine.filter((i) => i.status === 'resolved');
  return mine;
}
