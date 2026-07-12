import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { SearchFiltersControl } from '../components/SearchFiltersControl';
import { SearchResultCard } from '../components/SearchResultCard';
import { SearchResultCardSkeleton } from '../components/SearchResultCardSkeleton';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import {
  buildSearchPath,
  type SearchFilters,
  useSearchQueryParams,
} from '../hooks/useSearchQueryParams';
import { useCatalogSearchInfinite } from '../queries/discogsQueries';
import { useCreateLibraryEntry } from '../queries/libraryQueries';
import { ApiError } from '../services/apiClient';

const SKELETON_COUNT = 8;
const PAGE_SIZE = 20;
const resultsGridClasses =
  'grid list-none grid-cols-1 gap-4 p-0 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5';

const TEXT_FILTER_LABELS: Record<'genre' | 'style', string> = {
  genre: 'Genre',
  style: 'Style',
};

/**
 * Genre/Style show as a bare label ("Genre"); Format shows its actual
 * selected value(s) (e.g. "Format: Vinyl, CD") since it's a discrete,
 * enumerable multi-select where naming the selection is more useful than a
 * generic label (spec.md Edge Cases, feature 022).
 */
function activeFilterLabels(filters: SearchFilters): string[] {
  const labels = (Object.keys(TEXT_FILTER_LABELS) as (keyof typeof TEXT_FILTER_LABELS)[])
    .filter((name) => Boolean(filters[name]))
    .map((name) => TEXT_FILTER_LABELS[name]);
  if (filters.format && filters.format.length > 0) {
    labels.push(`Format: ${filters.format.join(', ')}`);
  }
  return labels;
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
  const [gateError, setGateError] = useState<'not-linked' | 'relink' | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  const searchQuery = useCatalogSearchInfinite(query, 'release', PAGE_SIZE, filters);
  const { hasNextPage, isFetchingNextPage, fetchNextPage, data, isLoading, isError } =
    searchQuery;
  const createEntry = useCreateLibraryEntry();

  const searched = query.trim().length > 0;
  const loading = isLoading;
  const results = data?.pages.flatMap((page) => page.results) ?? [];
  // The first page's request is what can fail before any results exist;
  // once at least one page has loaded, a later fetchNextPage failure is
  // surfaced separately below (next-batch retry) instead of replacing
  // already-loaded results with a full-page error (FR-010).
  const initialLoadError = !data && isError;
  const nextPageError = Boolean(data) && isError;
  const error =
    addError ??
    (initialLoadError ? 'Something went wrong while searching. Please try again.' : null);
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
      await createEntry.mutateAsync({ discogsReleaseId: discogsId });
      setAddedIds((prev) => new Set(prev).add(discogsId));
    } catch (err) {
      if (err instanceof ApiError && err.code === 'discogs_not_linked') {
        setGateError('not-linked');
      } else if (err instanceof ApiError && err.code === 'discogs_link_invalid') {
        setGateError('relink');
      } else {
        setAddError('Something went wrong while adding this record. Please try again.');
      }
    } finally {
      setAddingId(null);
    }
  }

  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-6 p-6 sm:p-8 xl:max-w-7xl">
      <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
        Search results
      </h1>

      <SearchFiltersControl
        filters={filters}
        onApply={applyFilters}
        onClear={clearFilters}
      />

      {!searched && (
        <p className="text-gray-500 dark:text-gray-400">
          Use the search box in the header to look up a record in the Discogs catalog.
        </p>
      )}

      {gateError && (
        <Card>
          <p className="text-gray-700 dark:text-gray-300">
            {gateError === 'not-linked'
              ? 'You need to link your Discogs account before adding records to your library.'
              : 'Your Discogs link is no longer valid. Please re-link your account to add records.'}
          </p>
          <Link
            to="/app/profile"
            className="mt-2 inline-block text-sm font-medium text-primary hover:opacity-80"
          >
            Go to your profile
          </Link>
        </Card>
      )}

      {error && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}

      {!loading && searched && results.length === 0 && (
        <p className="text-gray-500 dark:text-gray-400">
          {activeFilters.length > 0
            ? `No results found for the active filters (${activeFilters.join(', ')}). Try adjusting or clearing them.`
            : 'No results found. Try a different search.'}
        </p>
      )}

      {loading && (
        <ul className={resultsGridClasses} data-testid="search-results-skeleton">
          {Array.from({ length: SKELETON_COUNT }, (_, index) => (
            <li key={index}>
              <SearchResultCardSkeleton />
            </li>
          ))}
        </ul>
      )}

      {!loading && results.length > 0 && (
        <>
          <ul className={resultsGridClasses} data-testid="search-results-grid">
            {results.map((result) => (
              <li key={result.discogsId}>
                <SearchResultCard
                  result={result}
                  searchPath={currentSearchPath}
                  onAdd={() => handleAdd(result.discogsId)}
                  adding={addingId === result.discogsId}
                  added={addedIds.has(result.discogsId)}
                />
              </li>
            ))}
          </ul>
          {isFetchingNextPage && (
            <ul className={resultsGridClasses} data-testid="search-results-loading-more">
              {Array.from({ length: SKELETON_COUNT }, (_, index) => (
                <li key={index}>
                  <SearchResultCardSkeleton />
                </li>
              ))}
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
            <p className="text-center text-sm text-gray-500 dark:text-gray-400">
              No more results.
            </p>
          )}

          <div ref={sentinelRef} aria-hidden="true" />
        </>
      )}
    </main>
  );
}
