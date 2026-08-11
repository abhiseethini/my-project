/**
 * Firestore user profile operations.
 * Document path: users/{uid} — uid matches Firebase Authentication UID.
 */

import { db } from './firebase.js';
import { doc, setDoc, getDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

const USERS_COLLECTION = 'users';
const DEFAULT_ROLE = 'user';

/**
 * Ensures a Firestore profile exists for an Auth user (e.g. Google sign-in).
 * Skips the write if users/{uid} already exists.
 *
 * @param {import('firebase/auth').User} authUser — Firebase Auth user object
 */
export async function ensureUserProfile(authUser) {
  const userRef = doc(db, USERS_COLLECTION, authUser.uid);

  try {
    const snapshot = await getDoc(userRef);

    if (snapshot.exists()) {
      console.log('Firestore profile already exists at users/' + authUser.uid);
      return;
    }

    await setDoc(
      userRef,
      {
        name: authUser.displayName || '',
        email: authUser.email || '',
        role: DEFAULT_ROLE,
        createdAt: serverTimestamp(),
      },
      { merge: true }
    );
    console.log('Firestore profile created at users/' + authUser.uid);
  } catch (err) {
    console.error('Firestore ensureUserProfile failed:', err.code, err.message, err);
    throw err;
  }
}

/**
 * Creates a Firestore profile for a newly registered Auth user.
 * Role is always set server-side; never taken from client input.
 *
 * @param {import('firebase/auth').User} authUser — Firebase Auth user object
 * @param {{ name: string, email: string }} profile — Profile fields from signup
 */
export async function createUserProfile(authUser, { name, email }) {
  const userRef = doc(db, USERS_COLLECTION, authUser.uid);

  try {
    await setDoc(userRef, {
      name: name || '',
      email,
      role: DEFAULT_ROLE,
      createdAt: serverTimestamp(),
    });
    console.log('Firestore profile created at users/' + authUser.uid);
  } catch (err) {
    console.error('Firestore setDoc failed:', err.code, err.message, err);
    throw err;
  }
}

/**
 * Fetches a user's Firestore profile by Auth UID.
 *
 * @param {string} uid — Firebase Authentication UID
 * @returns {Promise<object|null>} Profile data, or null if not found
 */
export async function getUserProfile(uid) {
  const userRef = doc(db, USERS_COLLECTION, uid);
  const snapshot = await getDoc(userRef);
  return snapshot.exists() ? snapshot.data() : null;
}
