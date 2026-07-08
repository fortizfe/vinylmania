import { Link } from 'react-router-dom';

import { Card } from './ui/Card';

interface LibraryLinkRequiredProps {
  /**
   * `not-linked`: the user never linked a Discogs account (409).
   * `relink`: Discogs rejected the stored credentials (401) — the user
   * revoked access externally and must link again.
   */
  variant: 'not-linked' | 'relink';
}

const COPY = {
  'not-linked': {
    title: 'Link your Discogs account',
    body: 'Your library is synchronized with your Discogs collection. Link your accounts from your profile to start using it.',
  },
  relink: {
    title: 'Your Discogs link is no longer valid',
    body: 'Discogs rejected the stored connection — it may have been revoked from your Discogs settings. Re-link your account from your profile to keep using your library.',
  },
} as const;

export function LibraryLinkRequired({ variant }: LibraryLinkRequiredProps) {
  const copy = COPY[variant];

  return (
    <Card className="flex min-h-48 flex-col items-start justify-center gap-3">
      <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
        {copy.title}
      </h2>
      <p className="text-gray-500 dark:text-gray-400">{copy.body}</p>
      <Link
        to="/app/profile"
        className="rounded-xl bg-primary px-4 py-2 text-sm font-medium text-white hover:opacity-90"
      >
        Go to your profile
      </Link>
    </Card>
  );
}
