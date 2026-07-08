import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

import { DiscogsConnectionCard } from '../components/DiscogsConnectionCard';
import type { DiscogsOutcome } from './DiscogsCallbackPage';

const OUTCOME_MESSAGES: Record<
  DiscogsOutcome,
  { text: string; tone: 'success' | 'warning' }
> = {
  linked: { text: 'Discogs account linked.', tone: 'success' },
  denied: {
    text: 'The Discogs connection was not completed. You can try again whenever you like.',
    tone: 'warning',
  },
  expired: {
    text: 'This link attempt expired. Please start again from your profile.',
    tone: 'warning',
  },
  error: {
    text: 'Something went wrong while linking your Discogs account. Please try again.',
    tone: 'warning',
  },
};

const TONE_CLASSES: Record<'success' | 'warning', string> = {
  success:
    'border-gray-200 bg-gray-50 text-gray-800 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-200',
  warning:
    'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200',
};

function OutcomeMessage({
  outcome,
  onDismiss,
}: Readonly<{ outcome: DiscogsOutcome; onDismiss: () => void }>) {
  const message = OUTCOME_MESSAGES[outcome];
  return (
    <output
      className={`flex items-center justify-between gap-4 rounded-xl border p-4 text-sm ${TONE_CLASSES[message.tone]}`}
    >
      <span>{message.text}</span>
      <button
        type="button"
        aria-label="Dismiss"
        onClick={onDismiss}
        className="font-medium opacity-70 transition-opacity hover:opacity-100"
      >
        ✕
      </button>
    </output>
  );
}

export function ProfilePage() {
  const location = useLocation();
  const navigate = useNavigate();
  const [outcome, setOutcome] = useState<DiscogsOutcome | null>(null);

  const stateOutcome = (location.state as { discogsOutcome?: DiscogsOutcome } | null)
    ?.discogsOutcome;

  useEffect(() => {
    if (stateOutcome) {
      setOutcome(stateOutcome);
      // Clear the router state so the message is one-shot per flow.
      navigate(location.pathname, { replace: true, state: null });
    }
  }, [stateOutcome, navigate, location.pathname]);

  return (
    <main className="mx-auto flex max-w-4xl flex-col gap-6 p-6 sm:p-8">
      <header>
        <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
          Profile
        </h1>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Manage your account and connected services.
        </p>
      </header>
      {outcome && <OutcomeMessage outcome={outcome} onDismiss={() => setOutcome(null)} />}
      <section aria-label="Connected services" className="flex flex-col gap-4">
        <DiscogsConnectionCard />
      </section>
    </main>
  );
}
