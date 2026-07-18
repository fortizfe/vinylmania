import { Link } from 'react-router-dom';

import { Card } from './ui/Card';

interface DiscogsRelinkNoticeProps {
  /** Defaults to the backend's own message (spec 053) — override only for a context-specific phrasing. */
  message?: string;
}

const DEFAULT_MESSAGE =
  'Your Discogs link is no longer valid. Please re-link your account from your profile.';

/**
 * Shown wherever a request fails with `discogs_link_invalid` — a linked
 * Discogs account whose credentials were revoked externally. Extracted
 * (spec 053) once this became needed on catalog read failures in addition
 * to the pre-existing "add to library" gate error, per the Constitution's
 * "extract once a pattern repeats" rule.
 */
export function DiscogsRelinkNotice({ message = DEFAULT_MESSAGE }: DiscogsRelinkNoticeProps) {
  return (
    <Card>
      <p className="text-stone-700 dark:text-stone-300">{message}</p>
      <Link
        to="/app/profile"
        className="mt-2 inline-block text-sm font-medium text-primary hover:opacity-80"
      >
        Go to your profile
      </Link>
    </Card>
  );
}
