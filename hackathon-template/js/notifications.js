/**
 * Firestore notifications for user activity.
 */

import { db } from './firebase.js';
import {
  collection,
  addDoc,
  updateDoc,
  doc,
  query,
  where,
  onSnapshot,
  serverTimestamp,
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

const COLLECTION = 'notifications';

export function subscribeToNotifications(uid, callback) {
  const q = query(collection(db, COLLECTION), where('toUid', '==', uid));

  return onSnapshot(
    q,
    (snap) => {
      const notifications = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .sort((a, b) => {
          const ta = a.createdAt?.toMillis?.() || 0;
          const tb = b.createdAt?.toMillis?.() || 0;
          return tb - ta;
        });
      callback(notifications);
    },
    (err) => console.error('Notifications error:', err)
  );
}

export async function createNotification({ toUid, fromUid, fromName, type, message, itemId, itemName }) {
  await addDoc(collection(db, COLLECTION), {
    toUid,
    fromUid,
    fromName: fromName || 'Someone',
    type,
    message,
    itemId: itemId || null,
    itemName: itemName || '',
    read: false,
    createdAt: serverTimestamp(),
  });
}

export async function markNotificationRead(notificationId) {
  await updateDoc(doc(db, COLLECTION, notificationId), { read: true });
}

export async function notifyContactRequest({ item, fromUser, message }) {
  await createNotification({
    toUid: item.reporterUid,
    fromUid: fromUser.uid,
    fromName: fromUser.displayName || fromUser.email,
    type: 'contact',
    message: message || `Someone is interested in your report: ${item.itemName}`,
    itemId: item.id,
    itemName: item.itemName,
  });

  await addDoc(collection(db, 'contactRequests'), {
    itemId: item.id,
    itemName: item.itemName,
    fromUid: fromUser.uid,
    fromName: fromUser.displayName || '',
    fromEmail: fromUser.email || '',
    toUid: item.reporterUid,
    message: message || '',
    createdAt: serverTimestamp(),
    read: false,
  });
}

export async function notifyPossibleMatch(lostItem, foundItem, toUid) {
  await createNotification({
    toUid,
    fromUid: 'system',
    fromName: 'Campus Lost & Found',
    type: 'match',
    message: `Possible match found: "${foundItem.itemName}" may match your lost "${lostItem.itemName}"`,
    itemId: lostItem.id,
    itemName: lostItem.itemName,
  });
}
