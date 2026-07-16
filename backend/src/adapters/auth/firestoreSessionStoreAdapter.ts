import { randomUUID } from 'node:crypto';

import { getFirestoreDb } from '../../config/firebase-admin';
import type { Session } from '../../domain/auth/session';
import type { SessionStorePort } from '../../ports/auth/sessionStorePort';

const SESSIONS_COLLECTION = 'sessions';

// Sliding-window renewal (feature 051, FR-018): as long as the session is
// used within this window, it never expires from the caller's perspective
// — that *is* silent renewal, with no separate refresh round trip needed.
const SLIDING_WINDOW_MS = 14 * 24 * 60 * 60 * 1000; // 14 days

// Throttle: only rewrite expiresAt when the session is getting close to
// expiring, instead of on every single authenticated request.
const RENEWAL_THRESHOLD_MS = SLIDING_WINDOW_MS / 2;

function sessionDoc(sessionId: string) {
  return getFirestoreDb().collection(SESSIONS_COLLECTION).doc(sessionId);
}

function toSession(sessionId: string, data: FirebaseFirestore.DocumentData): Session {
  return {
    sessionId,
    uid: data.uid,
    createdAt: data.createdAt.toDate().toISOString(),
    lastSeenAt: data.lastSeenAt.toDate().toISOString(),
    expiresAt: data.expiresAt.toDate().toISOString(),
  };
}

async function createSession(uid: string): Promise<Session> {
  const sessionId = randomUUID();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + SLIDING_WINDOW_MS);

  await sessionDoc(sessionId).set({
    uid,
    createdAt: now,
    lastSeenAt: now,
    expiresAt,
  });

  return {
    sessionId,
    uid,
    createdAt: now.toISOString(),
    lastSeenAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
  };
}

async function touchSession(sessionId: string): Promise<Session | null> {
  const snapshot = await sessionDoc(sessionId).get();
  if (!snapshot.exists) {
    return null;
  }

  const data = snapshot.data()!;
  const now = new Date();
  const expiresAt: Date = data.expiresAt.toDate();

  if (expiresAt.getTime() <= now.getTime()) {
    return null;
  }

  const remainingMs = expiresAt.getTime() - now.getTime();
  if (remainingMs > RENEWAL_THRESHOLD_MS) {
    // Not close to expiring yet — skip the write, return as-is.
    return toSession(sessionId, data);
  }

  const renewedExpiresAt = new Date(now.getTime() + SLIDING_WINDOW_MS);
  await sessionDoc(sessionId).update({ lastSeenAt: now, expiresAt: renewedExpiresAt });

  return {
    sessionId,
    uid: data.uid,
    createdAt: data.createdAt.toDate().toISOString(),
    lastSeenAt: now.toISOString(),
    expiresAt: renewedExpiresAt.toISOString(),
  };
}

async function revokeSession(sessionId: string): Promise<void> {
  await sessionDoc(sessionId).delete();
}

export const firestoreSessionStoreAdapter: SessionStorePort = {
  createSession,
  touchSession,
  revokeSession,
};
