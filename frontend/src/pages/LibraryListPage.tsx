import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import { RecordCard } from '../components/RecordCard';
import * as libraryApi from '../services/libraryApi';
import type { EnrichedLibraryEntry } from '../services/libraryApi';

export function LibraryListPage() {
  const [entries, setEntries] = useState<EnrichedLibraryEntry[] | null>(null);
  const [page, setPage] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const pageSize = 20;

  useEffect(() => {
    let cancelled = false;

    libraryApi.list(page, pageSize).then((response) => {
      if (cancelled) return;
      setEntries(response.items);
      setTotalItems(response.totalItems);
    });

    return () => {
      cancelled = true;
    };
  }, [page]);

  const hasNextPage = page * pageSize < totalItems;

  return (
    <main className="app-page">
      <h1>Your library</h1>
      <Link to="/app/add">Add a record</Link>

      {entries === null && <p>Loading your library…</p>}

      {entries?.length === 0 && <p>No records yet. Add your first one to get started.</p>}

      {entries && entries.length > 0 && (
        <>
          <ul className="record-list">
            {entries.map((entry) => (
              <RecordCard key={entry.id} entry={entry} />
            ))}
          </ul>
          <div className="pagination">
            <button type="button" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              Previous
            </button>
            <button type="button" disabled={!hasNextPage} onClick={() => setPage((p) => p + 1)}>
              Next
            </button>
          </div>
        </>
      )}
    </main>
  );
}
