import { type FormEvent, useState } from 'react';

import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Input } from '../components/ui/Input';
import { ReleasePreviewModal } from '../components/ReleasePreviewModal';
import { SearchResultCard } from '../components/SearchResultCard';
import { SearchResultCardSkeleton } from '../components/SearchResultCardSkeleton';
import * as discogsApi from '../services/discogsApi';
import * as libraryApi from '../services/libraryApi';
import type { Release } from '../services/libraryApi';
import type { CatalogSearchResult } from '../services/discogsApi';

const SKELETON_COUNT = 8;
const PAGE_SIZE = 20;
const resultsGridClasses =
  'grid list-none grid-cols-2 gap-4 p-0 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5';

export function AddRecordPage() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<CatalogSearchResult[]>([]);
  const [searched, setSearched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [addingId, setAddingId] = useState<number | null>(null);
  const [addedIds, setAddedIds] = useState<Set<number>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);

  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewRelease, setPreviewRelease] = useState<Release | null>(null);

  async function runSearch(pageToLoad: number) {
    setLoading(true);
    setError(null);
    try {
      const response = await discogsApi.search(query, 'release', pageToLoad, PAGE_SIZE);
      setResults(response.results);
      setSearched(true);
      setPage(response.pagination.page);
      setTotalPages(response.pagination.pages);
    } catch {
      setError('Something went wrong while searching. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  async function handleSearch(event: FormEvent) {
    event.preventDefault();
    await runSearch(1);
  }

  async function handleAdd(discogsId: number) {
    setAddingId(discogsId);
    setError(null);
    try {
      await libraryApi.create(discogsId);
      setAddedIds((prev) => new Set(prev).add(discogsId));
    } catch {
      setError('Something went wrong while adding this record. Please try again.');
    } finally {
      setAddingId(null);
    }
  }

  async function handlePreview(discogsId: number) {
    setPreviewOpen(true);
    setPreviewLoading(true);
    setPreviewRelease(null);
    try {
      const release = await discogsApi.getRelease(discogsId);
      setPreviewRelease(release);
    } catch {
      setPreviewRelease(null);
    } finally {
      setPreviewLoading(false);
    }
  }

  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-6 p-6 sm:p-8">
      <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">Add a record</h1>

      <Card>
        <form onSubmit={handleSearch} className="flex flex-col gap-4 sm:flex-row sm:items-end">
          <div className="flex-1">
            <Input
              id="record-search"
              label="Search Discogs"
              type="text"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
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
                  onPreview={() => handlePreview(result.discogsId)}
                  adding={addingId === result.discogsId}
                  added={addedIds.has(result.discogsId)}
                />
              </li>
            ))}
          </ul>
          {totalPages > 1 && (
            <div className="flex gap-3">
              <Button
                variant="secondary"
                disabled={page <= 1}
                onClick={() => runSearch(page - 1)}
              >
                Previous
              </Button>
              <Button
                variant="secondary"
                disabled={page >= totalPages}
                onClick={() => runSearch(page + 1)}
              >
                Next
              </Button>
            </div>
          )}
        </>
      )}

      <ReleasePreviewModal
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
        release={previewRelease}
        loading={previewLoading}
      />
    </main>
  );
}
