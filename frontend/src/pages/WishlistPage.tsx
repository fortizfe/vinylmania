import { useNavigate, useSearchParams } from 'react-router-dom';

import { RecordCardSkeleton } from '../components/RecordCardSkeleton';
import { WantlistCard } from '../components/WantlistCard';
import { WantlistLinkRequired } from '../components/WantlistLinkRequired';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { useRefreshWantlist, useWantlist } from '../queries/wantlistQueries';
import { ApiError } from '../services/apiClient';

const PAGE_SIZE = 20;
const SKELETON_COUNT = 8;
const gridClasses =
  'grid list-none grid-cols-1 gap-4 p-0 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5';

function gateVariant(error: unknown): 'not-linked' | 'relink' | null {
  if (error instanceof ApiError && error.code === 'discogs_not_linked') {
    return 'not-linked';
  }
  if (error instanceof ApiError && error.code === 'discogs_link_invalid') {
    return 'relink';
  }
  return null;
}

function readPage(value: string | null): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 1;
}

function pathForPage(page: number): string {
  return page > 1 ? `/app/wishlist?page=${page}` : '/app/wishlist';
}

export function WishlistPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const page = readPage(searchParams.get('page'));

  const { data, isLoading, isError: loadError, error } = useWantlist(page, PAGE_SIZE);
  const refresh = useRefreshWantlist(page, PAGE_SIZE);

  const entries = data?.items ?? null;
  const totalItems = data?.totalItems ?? 0;
  const hasNextPage = page * PAGE_SIZE < totalItems;
  const gate = loadError ? gateVariant(error) : null;

  // FR-002: while the accounts are not linked, the wishlist shows only the
  // gate — no cards, no refresh/pagination actions.
  if (gate) {
    return (
      <main className="mx-auto flex max-w-4xl flex-col gap-6 p-6 sm:p-8">
        <h1 className="font-display text-2xl leading-display tracking-display text-stone-900 dark:text-stone-100">
          Your wishlist
        </h1>
        <WantlistLinkRequired variant={gate} />
      </main>
    );
  }

  return (
    <main className="mx-auto flex max-w-4xl flex-col gap-6 p-6 sm:p-8 xl:max-w-7xl">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl leading-display tracking-display text-stone-900 dark:text-stone-100">
          Your wishlist
        </h1>
        <Button
          variant="secondary"
          loading={refresh.isPending}
          onClick={() => refresh.mutate()}
        >
          {refresh.isPending ? 'Refreshing…' : 'Refresh'}
        </Button>
      </div>

      {refresh.isError && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          Couldn&apos;t refresh from Discogs right now. Please try again.
        </p>
      )}

      {loadError && (
        <Card>
          <p role="alert" className="text-stone-500 dark:text-stone-400">
            Something went wrong while loading your wishlist. Please try again.
          </p>
        </Card>
      )}

      {!loadError && isLoading && (
        <ul className={gridClasses}>
          {Array.from({ length: SKELETON_COUNT }, (_, index) => (
            <RecordCardSkeleton key={index} />
          ))}
        </ul>
      )}

      {!loadError && !isLoading && entries?.length === 0 && (
        <Card>
          <p className="text-stone-500 dark:text-stone-400">
            Nothing on your wishlist yet. Add a release from search or its detail page.
          </p>
        </Card>
      )}

      {!loadError && entries && entries.length > 0 && (
        <>
          <ul className={gridClasses} data-testid="wishlist-grid">
            {entries.map((entry) => (
              <WantlistCard key={entry.discogsReleaseId} entry={entry} />
            ))}
          </ul>
          <div className="flex gap-3">
            <Button
              variant="secondary"
              disabled={page <= 1}
              onClick={() => navigate(pathForPage(page - 1))}
            >
              Previous
            </Button>
            <Button
              variant="secondary"
              disabled={!hasNextPage}
              onClick={() => navigate(pathForPage(page + 1))}
            >
              Next
            </Button>
          </div>
        </>
      )}
    </main>
  );
}
