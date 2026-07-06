import { useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

import { DiscogsConnectionCardSkeleton } from '../components/DiscogsConnectionCardSkeleton';
import { useCompleteDiscogsLink } from '../queries/discogsOauthQueries';

export type DiscogsOutcome = 'linked' | 'denied' | 'expired' | 'error';

/**
 * Landing route for Discogs' redirect after the user approves or denies
 * access. Completes the exchange through the backend, then returns to the
 * profile with a one-shot outcome in router state (state, not query params,
 * so refreshing the profile never replays the message).
 */
export function DiscogsCallbackPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const completeLink = useCompleteDiscogsLink();
  const startedRef = useRef(false);

  const oauthToken = searchParams.get('oauth_token');
  const oauthVerifier = searchParams.get('oauth_verifier');

  useEffect(() => {
    // The ref (which survives StrictMode's dev remount) ensures the exchange
    // runs exactly once; the mutateAsync promise chain (unlike mutate-scoped
    // callbacks, which are dropped on unmount) guarantees the navigation
    // still happens even though StrictMode unmounts the first instance.
    if (startedRef.current) {
      return;
    }
    startedRef.current = true;

    const finish = (discogsOutcome: DiscogsOutcome) =>
      navigate('/app/profile', { replace: true, state: { discogsOutcome } });

    if (!oauthToken || !oauthVerifier) {
      // Discogs signals refusal with a `denied` param (and no verifier).
      finish('denied');
      return;
    }

    completeLink
      .mutateAsync({ oauthToken, oauthVerifier })
      .then(() => finish('linked'))
      .catch((err: unknown) => {
        const code = (err as { code?: string } | null)?.code;
        finish(code === 'expired_request' ? 'expired' : 'error');
      });
  }, [oauthToken, oauthVerifier, completeLink, navigate]);

  return (
    <main className="mx-auto flex max-w-4xl flex-col gap-6 p-6 sm:p-8">
      <div data-testid="discogs-callback-skeleton">
        <DiscogsConnectionCardSkeleton />
      </div>
    </main>
  );
}
