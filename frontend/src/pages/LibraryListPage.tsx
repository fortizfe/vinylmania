import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { LibraryLinkRequired } from '../components/LibraryLinkRequired';
import { LibraryToolbar } from '../components/LibraryToolbar';
import { RecordCard } from '../components/RecordCard';
import { RecordCardSkeleton } from '../components/RecordCardSkeleton';
import { RecordListRow } from '../components/RecordListRow';
import { RecordListRowSkeleton } from '../components/RecordListRowSkeleton';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import {
  LIBRARY_SORT_OPTIONS,
  type LibrarySortValue,
} from '../constants/librarySortOptions';
import {
  buildLibraryPath,
  type LibraryFilters,
  useLibraryQueryParams,
} from '../hooks/useLibraryQueryParams';
import { useViewModePreference } from '../hooks/useViewModePreference';
import { useLibraryList, useRefreshLibrary } from '../queries/libraryQueries';
import { ApiError } from '../services/apiClient';

const SKELETON_COUNT = 8;
const gridClasses =
  'grid list-none grid-cols-1 gap-4 p-0 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5';
const listClasses = 'flex list-none flex-col gap-3 p-0';

function gateVariant(error: unknown): 'not-linked' | 'relink' | null {
  if (error instanceof ApiError && error.code === 'discogs_not_linked') {
    return 'not-linked';
  }
  if (error instanceof ApiError && error.code === 'discogs_link_invalid') {
    return 'relink';
  }
  return null;
}

function activeCount(filters: LibraryFilters): number {
  return (
    (filters.genre?.length ?? 0) +
    (filters.style?.length ?? 0) +
    (filters.format?.length ?? 0)
  );
}

export function LibraryListPage() {
  const navigate = useNavigate();
  const { sort, genre, style, format } = useLibraryQueryParams();
  const filters: LibraryFilters = { genre, style, format };
  const hasActiveFilters = activeCount(filters) > 0;
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  const {
    data,
    isLoading,
    isError,
    error,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
  } = useLibraryList(sort, filters);
  const refresh = useRefreshLibrary(sort, filters);
  const { mode, setMode } = useViewModePreference('vinylmania:view-mode:library');

  const pages = data?.pages;
  const lastPage = pages?.at(-1);
  const entries = pages?.flatMap((batch) => batch.items) ?? [];
  const totalItems = lastPage?.totalItems ?? 0;
  // Only the first batch can fail before anything is on screen; a later
  // failure keeps the loaded records and offers Retry instead (FR-013).
  const initialLoadError = !data && isError;
  const nextPageError = Boolean(data) && isError;
  const gate = initialLoadError ? gateVariant(error) : null;

  // D20: placeholders live in the same <ul> as the records, so a batch takes
  // exactly the cells it will fill and nothing already on screen shifts.
  const skeletonCount = isLoading
    ? SKELETON_COUNT
    : isFetchingNextPage
      ? Math.max(0, Math.min(lastPage?.pageSize ?? 0, totalItems - entries.length))
      : 0;
  const showList = !initialLoadError && (isLoading || entries.length > 0);
  const atEnd = entries.length > 0 && !hasNextPage && !nextPageError;
  const endMessage = `You've reached the end of your collection — ${totalItems} ${
    totalItems === 1 ? 'record' : 'records'
  }`;

  // FR-008: announce a sort change only once its results render. Derived from
  // the current sort, so rapid changes announce just the latest one.
  const [sortChanged, setSortChanged] = useState(false);
  const sortAnnouncement =
    sortChanged && data
      ? (LIBRARY_SORT_OPTIONS.find((o) => o.sort === sort.sort && o.dir === sort.dir)
          ?.announcement ?? '')
      : '';
  // FR-015 / FR-021a: same rule for a filter change. `data` belongs to the
  // current selection's cache entry (one key per sort+filters, D8), so an
  // abandoned selection's late response can neither render nor announce.
  const [filtersChanged, setFiltersChanged] = useState(false);
  const filterAnnouncement =
    filtersChanged && data
      ? totalItems === 0
        ? 'No records match the active filters.'
        : `Showing ${totalItems} ${totalItems === 1 ? 'record' : 'records'}.`
      : '';
  // FR-028 / contracts §5: each appended batch is announced once it renders,
  // with the end of the collection appended when that batch closed it. A
  // single-batch result (initial load, or a new sort/filter) announces no end.
  const [batchAnnouncement, setBatchAnnouncement] = useState('');
  useEffect(() => {
    const last = pages && pages.length > 1 ? pages[pages.length - 1] : undefined;
    if (!last) {
      setBatchAnnouncement('');
      return;
    }
    const loaded = `${last.items.length} more records loaded.`;
    setBatchAnnouncement(
      last.page * last.pageSize < last.totalItems
        ? loaded
        : `${loaded} End of collection, ${last.totalItems} records.`,
    );
  }, [pages]);

  // ponytail: duplicate of SearchResultsPage sentinel effect; extract a shared
  // hook when a third infinite list appears.
  useEffect(() => {
    const node = sentinelRef.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (
          entry.isIntersecting &&
          hasNextPage &&
          !isFetchingNextPage &&
          !nextPageError
        ) {
          fetchNextPage().catch(() => {
            // Surfaced reactively through `nextPageError` above.
          });
        }
      },
      // D9: start the next batch before the user reaches the end, and let the
      // re-created observer fire again so a tall screen fills itself.
      { rootMargin: '0px 0px 300px 0px' },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, nextPageError, fetchNextPage]);

  // D18: keyboard focus must never land under the sticky toolbar or the
  // floating capsule, so the scroll container offsets by both while this page
  // is mounted (3.75rem = the toolbar's own height).
  useEffect(() => {
    const root = document.documentElement;
    root.style.scrollPaddingTop = 'calc(var(--header-h) + 3.75rem)';
    root.style.scrollPaddingBottom = 'var(--capsule-clearance)';
    return () => {
      root.style.scrollPaddingTop = '';
      root.style.scrollPaddingBottom = '';
    };
  }, []);

  function changeSort(newSort: LibrarySortValue) {
    setSortChanged(true);
    setFiltersChanged(false);
    navigate(buildLibraryPath(filters, newSort), { replace: true });
    window.scrollTo({ top: 0 });
  }

  /** Live filter change: the selection lives in the URL, replacing it so the
   *  Back button leaves the library rather than walking back through ticks. */
  function changeFilters(newFilters?: LibraryFilters) {
    setSortChanged(false);
    setFiltersChanged(true);
    navigate(buildLibraryPath(newFilters, sort), { replace: true });
    window.scrollTo({ top: 0 });
  }

  // FR-003: while the accounts are not linked, the library shows only the
  // gate — no records, no add/refresh actions.
  if (gate) {
    return (
      <main className="mx-auto flex max-w-4xl flex-col gap-6 p-6 sm:p-8">
        <h1 className="font-display text-2xl leading-display tracking-display text-stone-900 dark:text-stone-100">
          Your library
        </h1>
        <LibraryLinkRequired variant={gate} />
      </main>
    );
  }

  // FR-015a: every record link carries the address it was opened from, so the
  // detail page's Back returns to this exact sort and filter selection.
  const currentLibraryPath = buildLibraryPath(filters, sort);

  return (
    <main className="mx-auto flex max-w-4xl flex-col gap-6 p-6 pb-(--capsule-clearance) sm:p-8 sm:pb-8 xl:max-w-7xl">
      <div className="flex items-center justify-between gap-4">
        <div className="flex flex-wrap items-baseline gap-x-3">
          <h1 className="font-display text-2xl leading-display tracking-display text-stone-900 dark:text-stone-100">
            Your library
          </h1>
          {/* FR-020: the total for the current filters, not the number of
              batches loaded so far. */}
          {data && (
            <p className="text-sm text-stone-500 dark:text-stone-400">
              {totalItems} {totalItems === 1 ? 'record' : 'records'}
            </p>
          )}
        </div>
        <Button
          variant="secondary"
          loading={refresh.isPending}
          onClick={() => refresh.mutate()}
        >
          {refresh.isPending ? 'Refreshing…' : 'Refresh'}
        </Button>
      </div>

      <LibraryToolbar
        mode={mode}
        onModeChange={setMode}
        sort={sort}
        onSortChange={changeSort}
        filters={filters}
        onFiltersChange={changeFilters}
        onClear={() => changeFilters(undefined)}
      />

      <p role="status" className="sr-only">
        {batchAnnouncement || sortAnnouncement || filterAnnouncement}
      </p>

      {refresh.isError && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          Couldn&apos;t refresh from Discogs right now. Please try again.
        </p>
      )}

      {initialLoadError && (
        <Card>
          <p className="text-stone-500 dark:text-stone-400">
            Something went wrong while loading your library. Please try again.
          </p>
        </Card>
      )}

      {!initialLoadError && !isLoading && entries.length === 0 && (
        <Card>
          <p className="text-stone-500 dark:text-stone-400">
            {hasActiveFilters
              ? 'No results for the active filters. Try adjusting or clearing them.'
              : 'No records yet. Add your first one to get started.'}
          </p>
        </Card>
      )}

      {showList && (
        <ul
          className={mode === 'list' ? listClasses : gridClasses}
          data-testid={mode === 'list' ? 'library-record-list' : 'library-record-grid'}
        >
          {entries.map((entry) =>
            mode === 'list' ? (
              <RecordListRow key={entry.id} entry={entry} from={currentLibraryPath} />
            ) : (
              <RecordCard key={entry.id} entry={entry} from={currentLibraryPath} />
            ),
          )}
          {Array.from({ length: skeletonCount }, (_, index) =>
            mode === 'list' ? (
              <RecordListRowSkeleton key={`placeholder-${index}`} />
            ) : (
              <RecordCardSkeleton key={`placeholder-${index}`} />
            ),
          )}
        </ul>
      )}

      {nextPageError && (
        <div className="flex flex-col items-center gap-2">
          <p role="alert" className="text-sm text-red-600 dark:text-red-400">
            Couldn&apos;t load more records. Please try again.
          </p>
          <Button variant="secondary" onClick={() => fetchNextPage()}>
            Retry
          </Button>
        </div>
      )}

      {atEnd && (
        <p className="text-center text-sm text-stone-500 dark:text-stone-400">
          {endMessage}
        </p>
      )}

      {entries.length > 0 && hasNextPage && (
        <div ref={sentinelRef} aria-hidden="true" data-testid="library-load-sentinel" />
      )}
    </main>
  );
}
