import { cert, getApps, initializeApp, type App } from 'firebase-admin/app';
import { getAuth, type Auth } from 'firebase-admin/auth';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';

let app: App;

function loadServiceAccount(): Record<string, unknown> | undefined {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (!raw) {
    return undefined;
  }
  return JSON.parse(raw);
}

export function getFirebaseApp(): App {
  if (getApps().length > 0) {
    return getApps()[0] as App;
  }

  const serviceAccount = loadServiceAccount();
  const projectId = process.env.FIREBASE_PROJECT_ID;

  app = serviceAccount
    ? initializeApp({ credential: cert(serviceAccount as never), projectId })
    : initializeApp({ projectId });

  return app;
}

export function getFirebaseAuth(): Auth {
  return getAuth(getFirebaseApp());
}

export function getFirestoreDb(): Firestore {
  return getFirestore(getFirebaseApp());
}
