/**
 * Firestore + Storage operations for lost & found items.
 */

import { db, storage } from './firebase.js';
import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  serverTimestamp,
  onSnapshot,
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
import { ref, uploadBytes, getDownloadURL } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-storage.js';

export const ITEMS_COLLECTION = 'items';

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

export function subscribeToItems(callback, onError) {
  const q = query(collection(db, ITEMS_COLLECTION), orderBy('createdAt', 'desc'));
  return onSnapshot(
    q,
    (snapshot) => {
      const items = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
      callback(items);
    },
    (err) => {
      console.error('Items subscription error:', err);
      if (onError) onError(err);
    }
  );
}

export async function uploadItemImage(uid, file) {
  const itemId = crypto.randomUUID();
  const ext = file.name.split('.').pop() || 'jpg';
  const storageRef = ref(storage, `items/${uid}/${itemId}/photo.${ext}`);
  await uploadBytes(storageRef, file);
  const url = await getDownloadURL(storageRef);
  return url;
}

export async function createItem(uid, data, imageFile) {
  let imageUrl = null;
  if (imageFile) {
    imageUrl = await uploadItemImage(uid, imageFile);
  }

  const docRef = await addDoc(collection(db, ITEMS_COLLECTION), {
    ...data,
    imageUrl,
    reporterUid: uid,
    status: 'active',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  return docRef.id;
}

export async function updateItem(itemId, data, imageFile, uid) {
  const updates = { ...data, updatedAt: serverTimestamp() };
  if (imageFile) {
    updates.imageUrl = await uploadItemImage(uid, imageFile);
  }
  await updateDoc(doc(db, ITEMS_COLLECTION, itemId), updates);
}

export async function deleteItem(itemId) {
  await deleteDoc(doc(db, ITEMS_COLLECTION, itemId));
}

export async function markItemResolved(itemId) {
  await updateDoc(doc(db, ITEMS_COLLECTION, itemId), {
    status: 'resolved',
    updatedAt: serverTimestamp(),
  });
}

export async function getItemById(itemId) {
  const snap = await getDoc(doc(db, ITEMS_COLLECTION, itemId));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

export function filterItems(items, filters) {
  const { search, type, category, location, status, dateFrom } = filters;
  const terms = (search || '').toLowerCase().trim().split(/\s+/).filter(Boolean);

  return items.filter((item) => {
    if (type && type !== 'all' && item.type !== type) return false;
    if (category && category !== 'all' && item.category !== category) return false;
    if (status && status !== 'all' && item.status !== status) return false;
    if (location && !item.location?.toLowerCase().includes(location.toLowerCase())) return false;

    if (dateFrom) {
      const itemDate = item.dateTime?.toDate?.() || new Date(item.dateTime);
      if (itemDate < new Date(dateFrom)) return false;
    }

    if (terms.length === 0) return true;

    const haystack = [
      item.itemName,
      item.category,
      item.description,
      item.location,
      item.color,
      item.brand,
      item.marks,
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
    myReports: items.filter((i) => i.reporterUid === uid).length,
  };
}

export function getRecentItems(items, limit = 6) {
  return items.filter((i) => i.status === 'active').slice(0, limit);
}

export function getResolvedStories(items, limit = 4) {
  return items.filter((i) => i.status === 'resolved').slice(0, limit);
}

export function getMyReports(items, uid, tab = 'all') {
  const mine = items.filter((i) => i.reporterUid === uid);
  if (tab === 'lost') return mine.filter((i) => i.type === 'lost');
  if (tab === 'found') return mine.filter((i) => i.type === 'found');
  if (tab === 'resolved') return mine.filter((i) => i.status === 'resolved');
  return mine;
}
