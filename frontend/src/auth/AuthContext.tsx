import {
  type ReactNode,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { onAuthStateChanged, signInWithPopup, signOut as firebaseSignOut } from 'firebase/auth';

import { firebaseAuth, googleAuthProvider } from '../services/firebaseClient';

export interface UserProfile {
  uid: string;
  displayName: string;
  email: string;
  photoURL?: string;
}

interface AuthContextValue {
  user: UserProfile | null;
  /** Whether the initial silent auth check (on page load) is still in flight. */
  loading: boolean;
  /** Whether a sign-in popup flow is currently in progress. */
  signingIn: boolean;
  error: string | null;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '';

function friendlyErrorMessage(err: unknown): string {
  const code = (err as { code?: string })?.code ?? '';

  switch (code) {
    case 'auth/popup-closed-by-user':
    case 'auth/cancelled-popup-request':
      return 'Sign-in was cancelled. You can try again whenever you are ready.';
    case 'auth/popup-blocked':
      return 'Your browser blocked the sign-in popup. Please allow popups for this site and try again.';
    case 'auth/network-request-failed':
      return 'We could not reach the sign-in service. Check your connection and try again.';
    default:
      return 'Something went wrong while signing in. Please try again.';
  }
}

async function establishSession(idToken: string): Promise<UserProfile> {
  const res = await fetch(`${API_BASE_URL}/api/auth/session`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${idToken}` },
  });

  if (!res.ok) {
    throw new Error('session_failed');
  }

  return res.json();
}

async function fetchExistingSession(idToken: string): Promise<UserProfile | null> {
  const res = await fetch(`${API_BASE_URL}/api/auth/me`, {
    headers: { Authorization: `Bearer ${idToken}` },
  });

  if (!res.ok) {
    return null;
  }

  return res.json();
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [signingIn, setSigningIn] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(firebaseAuth, async (firebaseUser) => {
      if (!firebaseUser) {
        setUser(null);
        setLoading(false);
        return;
      }

      try {
        const idToken = await firebaseUser.getIdToken();
        const profile = await fetchExistingSession(idToken);
        setUser(profile);
      } finally {
        setLoading(false);
      }
    });

    return unsubscribe;
  }, []);

  const signIn = useCallback(async () => {
    setError(null);
    setSigningIn(true);
    try {
      const result = await signInWithPopup(firebaseAuth, googleAuthProvider);
      const idToken = await result.user.getIdToken();
      const profile = await establishSession(idToken);
      setUser(profile);
    } catch (err) {
      setError(friendlyErrorMessage(err));
    } finally {
      setSigningIn(false);
    }
  }, []);

  const signOut = useCallback(async () => {
    await firebaseSignOut(firebaseAuth);
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({ user, loading, signingIn, error, signIn, signOut }),
    [user, loading, signingIn, error, signIn, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}
