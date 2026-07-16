import {
  type ReactNode,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

import { authorizedFetch, setUnauthorizedHandler } from '../services/apiClient';
import { completeGoogleLogin, type CompleteGoogleLoginInput } from '../services/googleAuthApi';
import { clearSessionToken, getSessionToken, setSessionToken } from '../services/sessionStore';

export interface UserProfile {
  uid: string;
  displayName: string;
  email: string;
  photoURL?: string;
  themePreference?: 'light' | 'dark';
}

export type LoginOutcome = 'success' | 'denied' | 'expired' | 'error';

interface AuthContextValue {
  user: UserProfile | null;
  /** Whether the initial silent session check (on page load) is still in flight. */
  loading: boolean;
  error: string | null;
  /** Full-page navigation to the backend's Google authorize URL — never a fetch/SDK call. */
  signIn: () => void;
  signOut: () => Promise<void>;
  /** Called by LoginCallbackPage once the browser returns from Google. */
  completeSignIn: (input: CompleteGoogleLoginInput) => Promise<LoginOutcome>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '';

function friendlyOutcomeMessage(outcome: 'denied' | 'expired' | 'error'): string {
  switch (outcome) {
    case 'denied':
      return 'Sign-in was cancelled. You can try again whenever you are ready.';
    case 'expired':
      return 'This sign-in attempt expired. Please try again.';
    default:
      return 'Something went wrong while signing in. Please try again.';
  }
}

async function fetchExistingSession(): Promise<UserProfile | null> {
  try {
    const res = await authorizedFetch('/api/auth/me');
    return res.json();
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setUnauthorizedHandler(() => setUser(null));

    let cancelled = false;
    (async () => {
      if (!getSessionToken()) {
        setLoading(false);
        return;
      }
      const profile = await fetchExistingSession();
      if (!cancelled) {
        setUser(profile);
        setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      setUnauthorizedHandler(null);
    };
  }, []);

  const signIn = useCallback(() => {
    window.location.assign(`${API_BASE_URL}/api/auth/google/authorize`);
  }, []);

  const signOut = useCallback(async () => {
    try {
      await authorizedFetch('/api/auth/session', { method: 'DELETE' });
    } finally {
      clearSessionToken();
      setUser(null);
    }
  }, []);

  const completeSignIn = useCallback(async (input: CompleteGoogleLoginInput): Promise<LoginOutcome> => {
    if (input.error) {
      setError(friendlyOutcomeMessage('denied'));
      return 'denied';
    }

    try {
      const { sessionToken, user: profile } = await completeGoogleLogin(input);
      setSessionToken(sessionToken);
      setUser(profile);
      setError(null);
      return 'success';
    } catch (err) {
      const code = (err as { code?: string } | null)?.code;
      const outcome: 'expired' | 'error' = code === 'expired_state' ? 'expired' : 'error';
      setError(friendlyOutcomeMessage(outcome));
      return outcome;
    }
  }, []);

  const value = useMemo(
    () => ({ user, loading, error, signIn, signOut, completeSignIn }),
    [user, loading, error, signIn, signOut, completeSignIn],
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
