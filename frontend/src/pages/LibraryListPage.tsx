import { useState } from 'react';
import { Link } from 'react-router-dom';

import { RecordCard } from '../components/RecordCard';
import { RecordCardSkeleton } from '../components/RecordCardSkeleton';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { useLibraryList } from '../queries/libraryQueries';

const SKELETON_COUNT = 8;
const gridClasses = 'grid list-none grid-cols-[repeat(auto-fill,minmax(10rem,1fr))] gap-4 p-0';

export function LibraryListPage() {
  const [page, setPage] = useState(1);
  const pageSize = 20;

  const { data, isLoading, isError: loadError } = useLibraryList(page, pageSize);
  const entries = data?.items ?? null;
  const totalItems = data?.totalItems ?? 0;
  const hasNextPage = page * pageSize < totalItems;

  return (
    <main className="mx-auto flex max-w-4xl flex-col gap-6 p-6 sm:p-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">Your library</h1>
        <Link
          to="/app/library/add"
          className="text-sm font-medium text-primary hover:opacity-80 dark:text-primary"
        >
          Add a record
        </Link>
      </div>

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

      {!loadError && entries?.length === 0 && (
        <Card>
          <p className="text-gray-500 dark:text-gray-400">
            No records yet. Add your first one to get started.
          </p>
        </Card>
      )}

      {!loadError && entries && entries.length > 0 && (
        <>
          <ul className={gridClasses}>
            {entries.map((entry) => (
              <RecordCard key={entry.id} entry={entry} />
            ))}
          </ul>
          <div className="flex gap-3">
            <Button
              variant="secondary"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
            >
              Previous
            </Button>
            <Button
              variant="secondary"
              disabled={!hasNextPage}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </Button>
          </div>
        </>
      )}
    </main>
  );
}
