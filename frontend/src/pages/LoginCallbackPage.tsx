import { useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

import { useAuth } from '../auth/AuthContext';
import { Card } from '../components/ui/Card';
import { Skeleton } from '../components/ui/Skeleton';

/**
 * Landing route for Google's redirect after the user approves or denies
 * access — the mirror of `DiscogsCallbackPage` for the login flow itself.
 * Completes the exchange through the backend via `AuthContext.completeSignIn`
 * (never a client-side SDK), then navigates into the app on success or back
 * to the landing page (which surfaces `AuthContext.error`) on any failure.
 */
export function LoginCallbackPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { completeSignIn } = useAuth();
  const startedRef = useRef(false);

  const code = searchParams.get('code') ?? undefined;
  const state = searchParams.get('state') ?? '';
  const error = searchParams.get('error') ?? undefined;

  useEffect(() => {
    // The ref (which survives StrictMode's dev remount) ensures the exchange
    // runs exactly once, mirroring DiscogsCallbackPage's same guard.
    if (startedRef.current) {
      return;
    }
    startedRef.current = true;

    completeSignIn({ state, code, error }).then((outcome) => {
      navigate(outcome === 'success' ? '/app' : '/', { replace: true });
    });
  }, [code, state, error, completeSignIn, navigate]);

  return (
    <main className="mx-auto flex max-w-4xl flex-col gap-6 p-6 sm:p-8">
      <div data-testid="login-callback-skeleton">
        <Card>
          <div className="flex min-h-36 flex-col items-center justify-center gap-4">
            <Skeleton className="h-10 w-10" rounded="full" />
            <Skeleton className="h-4 w-48" />
          </div>
        </Card>
      </div>
    </main>
  );
}
