import { type FormEvent, useState } from 'react';
import { useNavigate } from 'react-router-dom';

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
    <main className="app-page">
      <h1>Add a record</h1>
      <form onSubmit={handleSearch}>
        <label htmlFor="record-search">Search Discogs</label>
        <input
          id="record-search"
          type="text"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <button type="submit" disabled={loading}>
          {loading ? 'Searching…' : 'Search'}
        </button>
      </form>

      {error && <p role="alert">{error}</p>}

      {searched && results.length === 0 && <p>No results found. Try a different search.</p>}

      <ul>
        {results.map((result) => (
          <li key={result.discogsId}>
            <span>{result.title}</span>
            {result.year !== undefined && <span> ({result.year})</span>}
            <button
              type="button"
              onClick={() => handleAdd(result.discogsId)}
              disabled={addingId === result.discogsId}
            >
              {addingId === result.discogsId ? 'Adding…' : 'Add to library'}
            </button>
          </li>
        ))}
      </ul>
    </main>
  );
}
