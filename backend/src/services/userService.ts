import { FieldValue } from 'firebase-admin/firestore';

import { getFirestoreDb } from '../config/firebase-admin';

export type ThemePreference = 'light' | 'dark';

export interface UserProfile {
  uid: string;
  displayName: string;
  email: string;
  photoURL?: string;
  createdAt: string;
  lastSignInAt: string;
  themePreference?: ThemePreference;
}

export interface VerifiedIdentity {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string;
}

export async function getOrCreateUser(identity: VerifiedIdentity): Promise<UserProfile> {
  const docRef = getFirestoreDb().collection('users').doc(identity.uid);
  const snapshot = await docRef.get();
  const now = FieldValue.serverTimestamp();

  if (!snapshot.exists) {
    await docRef.set({
      uid: identity.uid,
      displayName: identity.displayName,
      email: identity.email,
      photoURL: identity.photoURL ?? null,
      createdAt: now,
      lastSignInAt: now,
    });
  } else {
    await docRef.update({ lastSignInAt: now });
  }

  const finalSnapshot = await docRef.get();
  return toUserProfile(finalSnapshot.data() as FirebaseFirestore.DocumentData);
}

export async function getUser(uid: string): Promise<UserProfile | null> {
  const snapshot = await getFirestoreDb().collection('users').doc(uid).get();
  if (!snapshot.exists) {
    return null;
  }
  return toUserProfile(snapshot.data() as FirebaseFirestore.DocumentData);
}

export async function updateThemePreference(
  uid: string,
  themePreference: ThemePreference,
): Promise<UserProfile> {
  const docRef = getFirestoreDb().collection('users').doc(uid);
  await docRef.update({ themePreference });

  const snapshot = await docRef.get();
  return toUserProfile(snapshot.data() as FirebaseFirestore.DocumentData);
}

function toUserProfile(data: FirebaseFirestore.DocumentData): UserProfile {
  return {
    uid: data.uid,
    displayName: data.displayName,
    email: data.email,
    photoURL: data.photoURL ?? undefined,
    createdAt: data.createdAt?.toDate?.().toISOString() ?? new Date().toISOString(),
    lastSignInAt: data.lastSignInAt?.toDate?.().toISOString() ?? new Date().toISOString(),
    ...(data.themePreference ? { themePreference: data.themePreference } : {}),
  };
}
