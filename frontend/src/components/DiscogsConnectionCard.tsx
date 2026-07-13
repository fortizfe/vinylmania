import { useState } from 'react';

import {
  useDiscogsStatus,
  useDisconnectDiscogs,
  useRequestDiscogsLink,
} from '../queries/discogsOauthQueries';
import { Badge } from './ui/Badge';
import { Button } from './ui/Button';
import { Card } from './ui/Card';
import { DiscogsConnectionCardSkeleton } from './DiscogsConnectionCardSkeleton';

function DiscogsMark() {
  return (
    <span
      aria-hidden="true"
      className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-stone-900 text-sm font-semibold text-white dark:bg-stone-100 dark:text-stone-900"
    >
      D
    </span>
  );
}

function formatLinkedDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export function DiscogsConnectionCard() {
  const status = useDiscogsStatus();
  const requestLink = useRequestDiscogsLink();
  const disconnect = useDisconnectDiscogs();
  const [confirmingDisconnect, setConfirmingDisconnect] = useState(false);

  if (status.isPending) {
    return <DiscogsConnectionCardSkeleton />;
  }

  if (status.isError || !status.data) {
    return (
      <Card>
        <div className="flex min-h-36 flex-col gap-4">
          <CardHeading />
          <p className="text-sm text-stone-600 dark:text-stone-400">
            We could not load your Discogs connection right now. Please try again later.
          </p>
        </div>
      </Card>
    );
  }

  return (
    <Card>
      <div className="flex min-h-36 flex-col gap-4">
        <CardHeading />
        {status.data.connected ? (
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-2">
              <Badge>Connected</Badge>
              <span className="text-sm font-medium text-stone-900 dark:text-stone-100">
                {status.data.discogsUsername}
              </span>
            </div>
            <p className="text-sm text-stone-600 dark:text-stone-400">
              Linked on {formatLinkedDate(status.data.linkedAt)}
            </p>
            {confirmingDisconnect ? (
              <div className="flex items-center gap-3">
                <span className="text-sm text-stone-600 dark:text-stone-400">
                  Disconnect your Discogs account?
                </span>
                <Button
                  variant="secondary"
                  onClick={() => {
                    disconnect.mutate();
                    setConfirmingDisconnect(false);
                  }}
                  loading={disconnect.isPending}
                  aria-label="Confirm disconnect"
                >
                  Confirm disconnect
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => setConfirmingDisconnect(false)}
                  aria-label="Keep connection"
                >
                  Keep connection
                </Button>
              </div>
            ) : (
              <div>
                <Button variant="secondary" onClick={() => setConfirmingDisconnect(true)}>
                  Disconnect
                </Button>
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <p className="text-sm text-stone-600 dark:text-stone-400">
              Not connected. Link your Discogs account to prepare for collection syncing.
            </p>
            <div>
              <Button
                onClick={() => requestLink.mutate()}
                loading={requestLink.isPending}
              >
                Connect Discogs account
              </Button>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}

function CardHeading() {
  return (
    <div className="flex items-center gap-3">
      <DiscogsMark />
      <div>
        <h2 className="font-semibold text-stone-900 dark:text-stone-100">Discogs</h2>
        <p className="text-sm text-stone-600 dark:text-stone-400">
          Link your Vinylmania account with your Discogs account.
        </p>
      </div>
    </div>
  );
}
