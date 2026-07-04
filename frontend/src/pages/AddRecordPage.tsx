import { type FormEvent, useState } from 'react';

import { BackLink } from '../components/ui/BackLink';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Input } from '../components/ui/Input';
import { ReleasePreviewModal } from '../components/ReleasePreviewModal';
import { SearchResultCard } from '../components/SearchResultCard';
import { SearchResultCardSkeleton } from '../components/SearchResultCardSkeleton';
import { useCatalogRelease, useCatalogSearch } from '../queries/discogsQueries';
import { useCreateLibraryEntry } from '../queries/libraryQueries';

const SKELETON_COUNT = 8;
const PAGE_SIZE = 20;
const resultsGridClasses =
  'grid list-none grid-cols-2 gap-4 p-0 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5';

export function AddRecordPage() {
  const [queryInput, setQueryInput] = useState('');
  const [submittedQuery, setSubmittedQuery] = useState('');
  const [page, setPage] = useState(1);
  const [addingId, setAddingId] = useState<number | null>(null);
  const [addedIds, setAddedIds] = useState<Set<number>>(new Set());
  const [addError, setAddError] = useState<string | null>(null);
  const [previewDiscogsId, setPreviewDiscogsId] = useState<number | null>(null);

  const searchQuery = useCatalogSearch(submittedQuery, 'release', page, PAGE_SIZE);
  const previewQuery = useCatalogRelease(previewDiscogsId ?? undefined);
  const createEntry = useCreateLibraryEntry();

  const searched = submittedQuery.trim().length > 0;
  const loading = searchQuery.isLoading;
  const results = searchQuery.data?.results ?? [];
  const totalPages = searchQuery.data?.pagination.pages ?? 0;
  const error = addError ?? (searchQuery.isError ? 'Something went wrong while searching. Please try again.' : null);

  function handleSearch(event: FormEvent) {
    event.preventDefault();
    setAddError(null);
    setPage(1);
    setSubmittedQuery(queryInput);
  }

  async function handleAdd(discogsId: number) {
    setAddingId(discogsId);
    setAddError(null);
    try {
      await createEntry.mutateAsync({ discogsReleaseId: discogsId });
      setAddedIds((prev) => new Set(prev).add(discogsId));
    } catch {
      setAddError('Something went wrong while adding this record. Please try again.');
    } finally {
      setAddingId(null);
    }
  }

  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-6 p-6 sm:p-8">
      <BackLink to="/app/library" />
      <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">Add a record</h1>

      <Card>
        <form onSubmit={handleSearch} className="flex flex-col gap-4 sm:flex-row sm:items-end">
          <div className="flex-1">
            <Input
              id="record-search"
              label="Search Discogs"
              type="text"
              value={queryInput}
              onChange={(event) => setQueryInput(event.target.value)}
            />
          </div>
          <Button type="submit" loading={loading}>
            {loading ? 'Searching…' : 'Search'}
          </Button>
        </form>
      </Card>

      {error && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}

      {!loading && searched && results.length === 0 && (
        <p className="text-gray-500 dark:text-gray-400">No results found. Try a different search.</p>
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
          <ul className={resultsGridClasses}>
            {results.map((result) => (
              <li key={result.discogsId}>
                <SearchResultCard
                  result={result}
                  onAdd={() => handleAdd(result.discogsId)}
                  onPreview={() => setPreviewDiscogsId(result.discogsId)}
                  adding={addingId === result.discogsId}
                  added={addedIds.has(result.discogsId)}
                />
              </li>
            ))}
          </ul>
          {totalPages > 1 && (
            <div className="flex gap-3">
              <Button variant="secondary" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                Previous
              </Button>
              <Button
                variant="secondary"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </Button>
            </div>
          )}
        </>
      )}

      <ReleasePreviewModal
        open={previewDiscogsId !== null}
        onClose={() => setPreviewDiscogsId(null)}
        release={previewQuery.data ?? null}
        loading={previewQuery.isLoading}
      />
    </main>
  );
}
