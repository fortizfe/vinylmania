import { Link } from 'react-router-dom';

import { useCatalogMasterVersions } from '../queries/discogsQueries';
import { Button } from './ui/Button';
import { MasterVersionsTableSkeleton } from './MasterVersionsTableSkeleton';

interface MasterVersionsTableProps {
  discogsId: number;
  page: number;
  onPageChange: (page: number) => void;
}

/** Paginated (10/page) table of a master's releases, each row linking to its own detail page (spec FR-009/FR-010/FR-011). */
export function MasterVersionsTable({ discogsId, page, onPageChange }: MasterVersionsTableProps) {
  const { data, isLoading } = useCatalogMasterVersions(discogsId, page);

  if (isLoading || !data) {
    return <MasterVersionsTableSkeleton />;
  }

  const { results, pagination } = data;

  return (
    <div className="flex flex-col gap-3">
      <h4 className="font-semibold text-gray-900 dark:text-gray-100">Versions</h4>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="text-gray-500 dark:text-gray-400">
              <th className="py-2 pr-4 font-medium">Title</th>
              <th className="py-2 pr-4 font-medium">Format</th>
              <th className="py-2 pr-4 font-medium">Year</th>
              <th className="py-2 pr-4 font-medium">Label</th>
              <th className="py-2 pr-4 font-medium">Country</th>
            </tr>
          </thead>
          <tbody>
            {results.map((version) => (
              <tr key={version.discogsId} className="border-t border-gray-200 dark:border-gray-800">
                <td className="py-2 pr-4">
                  <Link
                    to={`/app/releases/${version.discogsId}`}
                    state={{ from: `/app/masters/${discogsId}?page=${page}` }}
                    className="font-medium text-gray-900 no-underline hover:text-primary dark:text-gray-100"
                  >
                    {version.title}
                  </Link>
                </td>
                <td className="py-2 pr-4 text-gray-500 dark:text-gray-400">{version.format ?? '—'}</td>
                <td className="py-2 pr-4 text-gray-500 dark:text-gray-400">{version.year ?? '—'}</td>
                <td className="py-2 pr-4 text-gray-500 dark:text-gray-400">{version.label ?? '—'}</td>
                <td className="py-2 pr-4 text-gray-500 dark:text-gray-400">{version.country ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {pagination.pages > 1 && (
        <div className="flex gap-3">
          <Button variant="secondary" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
            Previous
          </Button>
          <Button
            variant="secondary"
            disabled={page >= pagination.pages}
            onClick={() => onPageChange(page + 1)}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
}
