import { useState } from 'react';

import { CollectionGrowthChart } from '../components/stats/CollectionGrowthChart';
import { CollectionTotals } from '../components/stats/CollectionTotals';
import { StatBreakdownList } from '../components/stats/StatBreakdownList';
import { TopArtistsList } from '../components/stats/TopArtistsList';
import { CollectionValuationCard } from '../components/valuation/CollectionValuationCard';
import { MostValuableRecords } from '../components/valuation/MostValuableRecords';
import { ValuationBreakdownDialog } from '../components/valuation/ValuationBreakdownDialog';
import { ValuationUnavailableNotice } from '../components/valuation/ValuationUnavailableNotice';
import { LibraryLinkRequired } from '../components/LibraryLinkRequired';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Skeleton } from '../components/ui/Skeleton';
import {
  useCollectionStatistics,
  useProgressiveValuation,
} from '../queries/collectionStatsQueries';
import { ApiError } from '../services/apiClient';

const h1ClassName =
  'font-display text-2xl leading-display tracking-display text-stone-900 dark:text-stone-100';

/**
 * Maps a load error to the link-required gate variant, or `null` when the
 * failure is unrelated to the Discogs link (mirror of `WishlistPage`).
 */
function gateVariant(error: unknown): 'not-linked' | 'relink' | null {
  if (error instanceof ApiError && error.code === 'discogs_not_linked') {
    return 'not-linked';
  }
  if (error instanceof ApiError && error.code === 'discogs_link_invalid') {
    return 'relink';
  }
  return null;
}

function StatsSkeleton() {
  return (
    <div data-testid="stats-skeleton" aria-hidden="true" className="flex flex-col gap-8">
      <Skeleton className="h-28 w-full" />
      <div className="grid gap-6 md:grid-cols-2">
        {Array.from({ length: 4 }, (_, index) => (
          <Skeleton key={index} className="h-44 w-full" />
        ))}
      </div>
      <Skeleton className="h-40 w-full" />
      <Skeleton className="h-56 w-full" />
    </div>
  );
}

export function CollectionStatsPage() {
  const { data, isLoading, isError, error } = useCollectionStatistics();

  const isEmpty = !!data && data.totalRecords === 0;
  const hasStats = !!data && data.totalRecords > 0;

  // Block 2 runs independently of Block 1 and must never block this page
  // (FR-012, FR-020). It only makes sense once we know there is a non-empty,
  // linked collection — the hook stays dormant until then.
  const valuation = useProgressiveValuation(hasStats);
  const [breakdownOpen, setBreakdownOpen] = useState(false);

  const gate = isError ? gateVariant(error) : null;

  // FR-002: while the account is not linked, the section shows only the gate —
  // no statistics, no valuation.
  if (gate) {
    return (
      <main className="mx-auto flex max-w-4xl flex-col gap-6 p-6 sm:p-8">
        <h1 className={h1ClassName}>Mi colección en cifras</h1>
        <LibraryLinkRequired variant={gate} context="stats" />
      </main>
    );
  }

  const showBreakdownTrigger =
    !!valuation.perDisc && valuation.perDisc.length > 0 && !valuation.notice;

  return (
    <main className="mx-auto flex max-w-4xl flex-col gap-8 p-6 sm:p-8 xl:max-w-7xl">
      <header className="flex flex-col gap-1">
        <h1 className={h1ClassName}>Mi colección en cifras</h1>
        <p className="text-stone-500 dark:text-stone-400">
          Your collection by the numbers, built from your synced Discogs collection.
        </p>
      </header>

      {isError && !gate && (
        <Card>
          <p role="alert" className="text-stone-500 dark:text-stone-400">
            Something went wrong while loading your collection stats. Please try again.
          </p>
        </Card>
      )}

      {!isError && isLoading && <StatsSkeleton />}

      {isEmpty && (
        <Card>
          <p className="text-stone-500 dark:text-stone-400">
            Your Discogs collection has no records yet. Add some records on Discogs and
            they&apos;ll show up here.
          </p>
        </Card>
      )}

      {hasStats && (
        <section
          aria-labelledby="collection-statistics-heading"
          className="flex flex-col gap-6"
        >
          <h2
            id="collection-statistics-heading"
            className="text-lg font-semibold text-stone-900 dark:text-stone-100"
          >
            Collection statistics
          </h2>

          <CollectionTotals
            totalRecords={data.totalRecords}
            mostPresentArtist={data.mostPresentArtist}
          />

          <div className="grid gap-6 md:grid-cols-2">
            <StatBreakdownList title="By decade" breakdown={data.byDecade} />
            <StatBreakdownList title="By genre" breakdown={data.byGenre} />
            <StatBreakdownList title="By style" breakdown={data.byStyle} />
            <StatBreakdownList title="By label" breakdown={data.byLabel} />
          </div>

          <TopArtistsList
            artists={data.topArtists}
            mostPresent={data.mostPresentArtist}
          />

          <CollectionGrowthChart growth={data.growth} />
        </section>
      )}

      {hasStats && (
        <section
          aria-labelledby="collection-valuation-heading"
          className="flex flex-col gap-6"
        >
          <h2
            id="collection-valuation-heading"
            className="text-lg font-semibold text-stone-900 dark:text-stone-100"
          >
            Estimated market value
          </h2>

          {valuation.notice ? (
            <ValuationUnavailableNotice
              variant={valuation.notice}
              onRetry={valuation.retry}
            />
          ) : (
            <>
              <CollectionValuationCard
                valuation={valuation.valuation}
                progress={valuation.progress}
                status={valuation.status}
                retryable={valuation.retryable}
                onRetryFailed={() => valuation.retry('failed')}
              />

              {valuation.valuation && valuation.valuation.topValuable.length > 0 && (
                <MostValuableRecords
                  records={valuation.valuation.topValuable}
                  currency={valuation.valuation.currency}
                />
              )}

              {showBreakdownTrigger && (
                <div>
                  <Button
                    variant="secondary"
                    onClick={() => setBreakdownOpen(true)}
                  >
                    Ver todos
                  </Button>
                </div>
              )}
            </>
          )}
        </section>
      )}

      {valuation.perDisc && (
        <ValuationBreakdownDialog
          open={breakdownOpen}
          onClose={() => setBreakdownOpen(false)}
          rows={valuation.perDisc}
          currency={valuation.valuation?.currency ?? null}
        />
      )}
    </main>
  );
}
