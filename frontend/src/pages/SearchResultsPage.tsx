import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { DiscogsRelinkNotice } from '../components/DiscogsRelinkNotice';
import { FiltersControl } from '../components/FiltersControl';
import { SearchResultCard } from '../components/SearchResultCard';
import { SearchResultCardSkeleton } from '../components/SearchResultCardSkeleton';
import { SearchResultListRow } from '../components/SearchResultListRow';
import { SearchResultListRowSkeleton } from '../components/SearchResultListRowSkeleton';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { focusRing } from '../components/ui/focusRing';
import { ViewModeToggle } from '../components/ui/ViewModeToggle';
import {
  buildSearchPath,
  type SearchFilters,
  useSearchQueryParams,
} from '../hooks/useSearchQueryParams';
import { useViewModePreference } from '../hooks/useViewModePreference';
import { useCatalogSearchInfinite } from '../queries/discogsQueries';
import { useCreateLibraryEntry } from '../queries/libraryQueries';
import { useAddToWantlist } from '../queries/wantlistQueries';
import { ApiError } from '../services/apiClient';

const SKELETON_COUNT = 8;

/**
 * Feature 060, FR-013: the library add succeeded but the automatic wantlist
 * removal did not — non-blocking, the user just needs to tidy their wishlist.
 */
const WISHLIST_REMOVAL_FAILED_NOTICE =
  "Added to your library. We couldn't remove it from your wishlist — remove it there when you can.";

/**
 * The Discogs-link gate can be tripped by either add action (feature 060,
 * US2). The two destinations carry their own copy so the message names the
 * section the user was actually adding to — never the wrong one.
 */
type GateError = { variant: 'not-linked' | 'relink'; context: 'library' | 'wishlist' };

function gateMessage({ variant, context }: GateError): string {
  const target = context === 'wishlist' ? 'your wishlist' : 'your library';
  return variant === 'relink'
    ? `Your Discogs link is no longer valid. Please re-link your account to add records to ${target}.`
    : `You need to link your Discogs account before adding records to ${target}.`;
}

const PAGE_SIZE = 20;
const resultsGridClasses =
  'grid list-none grid-cols-1 gap-4 p-0 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5';
const resultsListClasses = 'flex list-none flex-col gap-3 p-0';

const FILTER_LABELS: Record<keyof SearchFilters, string> = {
  genre: 'Genre',
  style: 'Style',
  format: 'Format',
};

/**
 * Every filter (Genre, Style, Format) is now a discrete, enumerable
 * multi-select (feature 038), so each shows its actual selected value(s)
 * (e.g. "Format: Vinyl, CD") rather than a bare label.
 */
function activeFilterLabels(filters: SearchFilters): string[] {
  return (Object.keys(FILTER_LABELS) as (keyof SearchFilters)[])
    .filter((name) => (filters[name]?.length ?? 0) > 0)
    .map((name) => `${FILTER_LABELS[name]}: ${filters[name]!.join(', ')}`);
}

export function SearchResultsPage() {
  const navigate = useNavigate();
  // `page` from useSearchQueryParams is intentionally not read here: infinite
  // scroll paginates internally via useCatalogSearchInfinite, so only the
  // filter fields are forwarded as `filters` (spec FR-004/FR-005).
  const { query, genre, style, format } = useSearchQueryParams();
  const filters: SearchFilters = { genre, style, format };
  const [addingId, setAddingId] = useState<number | null>(null);
  const [addedIds, setAddedIds] = useState<Set<number>>(new Set());
  const [addError, setAddError] = useState<string | null>(null);
  const [gateError, setGateError] = useState<GateError | null>(null);
  const [addingWantlistId, setAddingWantlistId] = useState<number | null>(null);
  const [wantlistIds, setWantlistIds] = useState<Set<number>>(new Set());
  const [wantlistNotes, setWantlistNotes] = useState<Map<number, string>>(new Map());
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const { mode, setMode } = useViewModePreference('vinylmania:view-mode:search');

  const searchQuery = useCatalogSearchInfinite(query, 'release', PAGE_SIZE, filters);
  const {
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
    data,
    isLoading,
    isError,
    error: searchError,
  } = searchQuery;
  const createEntry = useCreateLibraryEntry();
  const addToWantlist = useAddToWantlist();

  const searched = query.trim().length > 0;
  const loading = isLoading;
  const results = data?.pages.flatMap((page) => page.results) ?? [];
  // The first page's request is what can fail before any results exist;
  // once at least one page has loaded, a later fetchNextPage failure is
  // surfaced separately below (next-batch retry) instead of replacing
  // already-loaded results with a full-page error (FR-010).
  const initialLoadError = !data && isError;
  // The search request itself (not just the "add to library" mutation) can
  // now fail with discogs_link_invalid when the caller's linked account was
  // revoked (spec 053, US3) — surfaced with the same relink prompt.
  const searchRelinkRequired =
    initialLoadError &&
    searchError instanceof ApiError &&
    searchError.code === 'discogs_link_invalid';
  const nextPageError = Boolean(data) && isError;
  const error =
    addError ??
    (initialLoadError && !searchRelinkRequired
      ? 'Something went wrong while searching. Please try again.'
      : null);
  const activeFilters = activeFilterLabels(filters);
  // Carried as router state into detail pages so their back action returns
  // here with the same query/filters (spec FR-012); infinite scroll has no
  // single "current page" to preserve, so this always targets page 1.
  const currentSearchPath = buildSearchPath(query, 1, filters);

  useEffect(() => {
    const node = sentinelRef.current;
    if (!node) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && hasNextPage && !isFetchingNextPage && !nextPageError) {
        fetchNextPage().catch(() => {
          // Errors are surfaced reactively via `isError`/`nextPageError` above.
        });
      }
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, nextPageError, fetchNextPage]);

  function applyFilters(newFilters: SearchFilters) {
    navigate(buildSearchPath(query, 1, newFilters), { replace: true });
  }

  function clearFilters() {
    navigate(buildSearchPath(query, 1), { replace: true });
  }

  async function handleAdd(discogsId: number) {
    setAddingId(discogsId);
    setAddError(null);
    setGateError(null);
    try {
      const entry = await createEntry.mutateAsync({ discogsReleaseId: discogsId });
      setAddedIds((prev) => new Set(prev).add(discogsId));
      if (entry.wantlistRemoval === 'failed') {
        setWantlistNotes((prev) =>
          new Map(prev).set(discogsId, WISHLIST_REMOVAL_FAILED_NOTICE),
        );
      }
    } catch (err) {
      if (err instanceof ApiError && err.code === 'discogs_not_linked') {
        setGateError({ variant: 'not-linked', context: 'library' });
      } else if (err instanceof ApiError && err.code === 'discogs_link_invalid') {
        setGateError({ variant: 'relink', context: 'library' });
      } else {
        setAddError('Something went wrong while adding this record. Please try again.');
      }
    } finally {
      setAddingId(null);
    }
  }

  async function handleAddToWantlist(discogsId: number) {
    setAddingWantlistId(discogsId);
    setAddError(null);
    setGateError(null);
    try {
      const result = await addToWantlist.mutateAsync({ discogsReleaseId: discogsId });
      setWantlistIds((prev) => new Set(prev).add(discogsId));
      if (result.alreadyInLibrary) {
        setWantlistNotes((prev) =>
          new Map(prev).set(
            discogsId,
            'Added to your wishlist — already in your library.',
          ),
        );
      }
    } catch (err) {
      if (err instanceof ApiError && err.code === 'discogs_not_linked') {
        setGateError({ variant: 'not-linked', context: 'wishlist' });
      } else if (err instanceof ApiError && err.code === 'discogs_link_invalid') {
        setGateError({ variant: 'relink', context: 'wishlist' });
      } else {
        setAddError(
          'Something went wrong while adding this record to your wishlist. Please try again.',
        );
      }
    } finally {
      setAddingWantlistId(null);
    }
  }

  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-6 p-6 sm:p-8 xl:max-w-7xl">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl leading-display tracking-display text-stone-900 dark:text-stone-100">
          Search results
        </h1>
        <ViewModeToggle mode={mode} onChange={setMode} screen="search" />
      </div>

      <FiltersControl filters={filters} onApply={applyFilters} onClear={clearFilters} />

      {!searched && (
        <p className="text-stone-500 dark:text-stone-400">
          Use the search box in the header to look up a record in the Discogs catalog.
        </p>
      )}

      {gateError && (
        <Card>
          <p role="status" className="text-stone-700 dark:text-stone-300">
            {gateMessage(gateError)}
          </p>
          <Link
            to="/app/profile"
            className={`mt-2 inline-block rounded text-sm font-medium text-primary hover:opacity-80 dark:text-primary-text ${focusRing}`}
          >
            Go to your profile
          </Link>
        </Card>
      )}

      {searchRelinkRequired && <DiscogsRelinkNotice />}

      {error && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}

      {!loading && searched && results.length === 0 && (
        <p className="text-stone-500 dark:text-stone-400">
          {activeFilters.length > 0
            ? `No results found for the active filters (${activeFilters.join(', ')}). Try adjusting or clearing them.`
            : 'No results found. Try a different search.'}
        </p>
      )}

      {loading && (
        <ul
          className={mode === 'list' ? resultsListClasses : resultsGridClasses}
          data-testid="search-results-skeleton"
        >
          {Array.from({ length: SKELETON_COUNT }, (_, index) =>
            mode === 'list' ? (
              <SearchResultListRowSkeleton key={index} />
            ) : (
              <li key={index}>
                <SearchResultCardSkeleton />
              </li>
            ),
          )}
        </ul>
      )}

      {!loading && results.length > 0 && (
        <>
          {mode === 'list' ? (
            <ul className={resultsListClasses} data-testid="search-results-list">
              {results.map((result) => (
                <SearchResultListRow
                  key={result.discogsId}
                  result={result}
                  searchPath={currentSearchPath}
                  onAdd={() => handleAdd(result.discogsId)}
                  adding={addingId === result.discogsId}
                  added={addedIds.has(result.discogsId)}
                  onAddToWantlist={() => handleAddToWantlist(result.discogsId)}
                  addingToWantlist={addingWantlistId === result.discogsId}
                  inWantlist={wantlistIds.has(result.discogsId)}
                  wantlistNote={wantlistNotes.get(result.discogsId) ?? null}
                />
              ))}
            </ul>
          ) : (
            <ul className={resultsGridClasses} data-testid="search-results-grid">
              {results.map((result) => (
                <li key={result.discogsId}>
                  <SearchResultCard
                    result={result}
                    searchPath={currentSearchPath}
                    onAdd={() => handleAdd(result.discogsId)}
                    adding={addingId === result.discogsId}
                    added={addedIds.has(result.discogsId)}
                    onAddToWantlist={() => handleAddToWantlist(result.discogsId)}
                    addingToWantlist={addingWantlistId === result.discogsId}
                    inWantlist={wantlistIds.has(result.discogsId)}
                    wantlistNote={wantlistNotes.get(result.discogsId) ?? null}
                  />
                </li>
              ))}
            </ul>
          )}
          {isFetchingNextPage && (
            <ul
              className={mode === 'list' ? resultsListClasses : resultsGridClasses}
              data-testid="search-results-loading-more"
            >
              {Array.from({ length: SKELETON_COUNT }, (_, index) =>
                mode === 'list' ? (
                  <SearchResultListRowSkeleton key={index} />
                ) : (
                  <li key={index}>
                    <SearchResultCardSkeleton />
                  </li>
                ),
              )}
            </ul>
          )}

          {nextPageError && (
            <div className="flex flex-col items-center gap-2">
              <p role="alert" className="text-sm text-red-600 dark:text-red-400">
                Something went wrong while loading more results. Please try again.
              </p>
              <Button variant="secondary" onClick={() => fetchNextPage()}>
                Retry
              </Button>
            </div>
          )}

          {!hasNextPage && !nextPageError && !isFetchingNextPage && (
            <p className="text-center text-sm text-stone-500 dark:text-stone-400">
              No more results.
            </p>
          )}

          <div ref={sentinelRef} aria-hidden="true" />
        </>
      )}
    </main>
  );
}
