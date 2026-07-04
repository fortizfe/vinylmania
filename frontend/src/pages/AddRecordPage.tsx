import { type FormEvent, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Input } from '../components/ui/Input';
import { Skeleton } from '../components/ui/Skeleton';
import * as discogsApi from '../services/discogsApi';
import * as libraryApi from '../services/libraryApi';
import type { CatalogSearchResult } from '../services/discogsApi';

export function AddRecordPage() {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<CatalogSearchResult[]>([]);
  const [searched, setSearched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [addingId, setAddingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSearch(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const response = await discogsApi.search(query, 'release');
      setResults(response.results);
      setSearched(true);
    } catch {
      setError('Something went wrong while searching. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  async function handleAdd(discogsId: number) {
    setAddingId(discogsId);
    setError(null);
    try {
      await libraryApi.create(discogsId);
      navigate('/app');
    } catch {
      setError('Something went wrong while adding this record. Please try again.');
      setAddingId(null);
    }
  }

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-6 p-6 sm:p-8">
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
        <ul className="flex list-none flex-col gap-3 p-0" data-testid="search-results-skeleton">
          {Array.from({ length: 3 }, (_, index) => (
            <li key={index}>
              <Card padding="sm" className="flex items-center justify-between gap-4">
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-8 w-28" />
              </Card>
            </li>
          ))}
        </ul>
      )}

      {!loading && results.length > 0 && (
        <ul className="flex list-none flex-col gap-3 p-0">
          {results.map((result) => (
            <li key={result.discogsId}>
              <Card padding="sm" className="flex items-center justify-between gap-4">
                <span className="text-gray-900 dark:text-gray-100">
                  {result.title}
                  {result.year !== undefined && ` (${result.year})`}
                </span>
                <Button
                  variant="secondary"
                  onClick={() => handleAdd(result.discogsId)}
                  loading={addingId === result.discogsId}
                >
                  {addingId === result.discogsId ? 'Adding…' : 'Add to library'}
                </Button>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
