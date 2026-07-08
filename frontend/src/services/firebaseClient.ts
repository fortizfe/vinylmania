import { type FirebaseApp, getApps, initializeApp } from 'firebase/app';
import {
  type Auth,
  GoogleAuthProvider,
  connectAuthEmulator,
  getAuth,
} from 'firebase/auth';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

export const firebaseApp: FirebaseApp = getApps()[0] ?? initializeApp(firebaseConfig);

export const firebaseAuth: Auth = getAuth(firebaseApp);

// Opt-in only: never inferred from DEV/MODE, since those are also true for
// ordinary local development against a real Firebase project. Only the e2e
// suite (playwright.config.ts) sets this, so a real Google sign-in is never
// at risk of being accidentally routed to a local emulator, and a local dev
// server is never at risk of accidentally talking to it either.
if (import.meta.env.VITE_USE_FIREBASE_EMULATOR === 'true') {
  connectAuthEmulator(firebaseAuth, 'http://localhost:9099', { disableWarnings: true });
}

export const googleAuthProvider = new GoogleAuthProvider();
