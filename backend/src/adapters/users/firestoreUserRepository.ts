import { FieldValue } from 'firebase-admin/firestore';

import { getFirestoreDb } from '../../config/firebase-admin';
import type { ThemePreference, UserProfile } from '../../domain/users/types';
import type { UserRepositoryPort } from '../../ports/users/userRepositoryPort';

function usersCollection() {
  return getFirestoreDb().collection('users');
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

async function findByUid(uid: string): Promise<UserProfile | null> {
  const snapshot = await usersCollection().doc(uid).get();
  if (!snapshot.exists) {
    return null;
  }
  return toUserProfile(snapshot.data() as FirebaseFirestore.DocumentData);
}

async function create(profile: {
  uid: string;
  displayName: string;
  email: string;
  photoURL?: string;
}): Promise<UserProfile> {
  const docRef = usersCollection().doc(profile.uid);
  const now = FieldValue.serverTimestamp();
  await docRef.set({
    uid: profile.uid,
    displayName: profile.displayName,
    email: profile.email,
    photoURL: profile.photoURL ?? null,
    createdAt: now,
    lastSignInAt: now,
  });
  const snapshot = await docRef.get();
  return toUserProfile(snapshot.data() as FirebaseFirestore.DocumentData);
}

async function touchLastSignIn(uid: string): Promise<UserProfile> {
  const docRef = usersCollection().doc(uid);
  await docRef.update({ lastSignInAt: FieldValue.serverTimestamp() });
  const snapshot = await docRef.get();
  return toUserProfile(snapshot.data() as FirebaseFirestore.DocumentData);
}

async function updateThemePreference(
  uid: string,
  themePreference: ThemePreference,
): Promise<UserProfile> {
  const docRef = usersCollection().doc(uid);
  await docRef.update({ themePreference });
  const snapshot = await docRef.get();
  return toUserProfile(snapshot.data() as FirebaseFirestore.DocumentData);
}

export const firestoreUserRepository: UserRepositoryPort = {
  findByUid,
  create,
  touchLastSignIn,
  updateThemePreference,
};
