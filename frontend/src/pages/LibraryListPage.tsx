import { useNavigate } from 'react-router-dom';

import { FiltersControl } from '../components/FiltersControl';
import { LibraryLinkRequired } from '../components/LibraryLinkRequired';
import { RecordCard } from '../components/RecordCard';
import { RecordCardSkeleton } from '../components/RecordCardSkeleton';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import {
  buildLibraryPath,
  type LibraryFilters,
  useLibraryQueryParams,
} from '../hooks/useLibraryQueryParams';
import { useLibraryList, useRefreshLibrary } from '../queries/libraryQueries';
import { ApiError } from '../services/apiClient';

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

function activeCount(filters: LibraryFilters): number {
  return (
    (filters.genre?.length ?? 0) +
    (filters.style?.length ?? 0) +
    (filters.format?.length ?? 0)
  );
}

export function LibraryListPage() {
  const navigate = useNavigate();
  const pageSize = 20;
  const { page, genre, style, format } = useLibraryQueryParams();
  const filters: LibraryFilters = { genre, style, format };
  const hasActiveFilters = activeCount(filters) > 0;

  const { data, isLoading, isError: loadError, error } = useLibraryList(
    page,
    pageSize,
    filters,
  );
  const refresh = useRefreshLibrary(page, pageSize, filters);
  const entries = data?.items ?? null;
  const totalItems = data?.totalItems ?? 0;
  const hasNextPage = page * pageSize < totalItems;
  const gate = loadError ? gateVariant(error) : null;

  function applyFilters(newFilters: LibraryFilters) {
    navigate(buildLibraryPath(1, newFilters));
  }

  function clearFilters() {
    navigate(buildLibraryPath(1));
  }

  // FR-003: while the accounts are not linked, the library shows only the
  // gate — no records, no add/refresh actions.
  if (gate) {
    return (
      <main className="mx-auto flex max-w-4xl flex-col gap-6 p-6 sm:p-8">
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
          Your library
        </h1>
        <LibraryLinkRequired variant={gate} />
      </main>
    );
  }

  return (
    <main className="mx-auto flex max-w-4xl flex-col gap-6 p-6 sm:p-8 xl:max-w-7xl">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
          Your library
        </h1>
        <Button
          variant="secondary"
          loading={refresh.isPending}
          onClick={() => refresh.mutate()}
        >
          {refresh.isPending ? 'Refreshing…' : 'Refresh'}
        </Button>
      </div>

      <FiltersControl filters={filters} onApply={applyFilters} onClear={clearFilters} />

      {refresh.isError && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          Couldn&apos;t refresh from Discogs right now. Please try again.
        </p>
      )}

      {loadError && (
        <Card>
          <p className="text-gray-500 dark:text-gray-400">
            Something went wrong while loading your library. Please try again.
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

      {!loadError && !isLoading && entries?.length === 0 && hasActiveFilters && (
        <Card>
          <p className="text-gray-500 dark:text-gray-400">
            No results for the active filters. Try adjusting or clearing them.
          </p>
        </Card>
      )}

      {!loadError && !isLoading && entries?.length === 0 && !hasActiveFilters && (
        <Card>
          <p className="text-gray-500 dark:text-gray-400">
            No records yet. Add your first one to get started.
          </p>
        </Card>
      )}

      {!loadError && entries && entries.length > 0 && (
        <>
          <ul className={gridClasses} data-testid="library-record-grid">
            {entries.map((entry) => (
              <RecordCard key={entry.id} entry={entry} />
            ))}
          </ul>
          <div className="flex gap-3">
            <Button
              variant="secondary"
              disabled={page <= 1}
              onClick={() => navigate(buildLibraryPath(page - 1, filters))}
            >
              Previous
            </Button>
            <Button
              variant="secondary"
              disabled={!hasNextPage}
              onClick={() => navigate(buildLibraryPath(page + 1, filters))}
            >
              Next
            </Button>
          </div>
        </>
      )}
    </main>
  );
}
