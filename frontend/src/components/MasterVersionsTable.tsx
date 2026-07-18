import { Link } from 'react-router-dom';

import { useCatalogMasterVersions } from '../queries/discogsQueries';
import { ApiError } from '../services/apiClient';
import { Button } from './ui/Button';
import { Card } from './ui/Card';
import { DiscogsRelinkNotice } from './DiscogsRelinkNotice';
import { MasterVersionsTableSkeleton } from './MasterVersionsTableSkeleton';

interface MasterVersionsTableProps {
  discogsId: number;
  page: number;
  onPageChange: (page: number) => void;
}

/** Paginated (10/page) table of a master's releases, each row linking to its own detail page (spec FR-009/FR-010/FR-011). */
export function MasterVersionsTable({
  discogsId,
  page,
  onPageChange,
}: MasterVersionsTableProps) {
  const { data, isLoading, isError, error } = useCatalogMasterVersions(discogsId, page);

  if (isLoading) {
    return <MasterVersionsTableSkeleton />;
  }

  // This query fetches independently of the surrounding page's own master
  // fetch, so a revoked link (spec 053, US3) or any other failure here was
  // previously invisible — the skeleton would render forever. Surfaced with
  // the same relink prompt other catalog surfaces use, or a generic message.
  if (isError) {
    if (error instanceof ApiError && error.code === 'discogs_link_invalid') {
      return <DiscogsRelinkNotice />;
    }
    return (
      <p role="alert" className="text-sm text-red-600 dark:text-red-400">
        Couldn&apos;t load this master&apos;s versions. Please try again.
      </p>
    );
  }

  if (!data) {
    return <MasterVersionsTableSkeleton />;
  }

  const { results, pagination } = data;

  return (
    <div className="flex flex-col gap-3">
      <h4 className="font-semibold text-stone-900 dark:text-stone-100">Versions</h4>

      {/* Mobile: a stacked card list avoids the horizontal scroll a table
          would force at narrow widths (FR-005/spec 035). */}
      <ul className="flex flex-col gap-2 md:hidden" data-testid="master-versions-cards">
        {results.map((version) => (
          <li key={version.discogsId}>
            <Card padding="sm" className="flex flex-col gap-1">
              <Link
                to={`/app/releases/${version.discogsId}`}
                state={{ from: `/app/masters/${discogsId}?page=${page}` }}
                className="flex min-h-11 items-center font-medium text-stone-900 no-underline hover:text-primary dark:text-stone-100"
              >
                {version.title}
              </Link>
              <p className="text-sm text-stone-500 dark:text-stone-400">
                {[version.format, version.year, version.label, version.country]
                  .filter(Boolean)
                  .join(' · ') || '—'}
              </p>
            </Card>
          </li>
        ))}
      </ul>

      {/* Desktop/tablet (md and above): the original table layout. */}
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="text-stone-500 dark:text-stone-400">
              <th className="py-2 pr-4 font-medium">Title</th>
              <th className="py-2 pr-4 font-medium">Format</th>
              <th className="py-2 pr-4 font-medium">Year</th>
              <th className="py-2 pr-4 font-medium">Label</th>
              <th className="py-2 pr-4 font-medium">Country</th>
            </tr>
          </thead>
          <tbody>
            {results.map((version) => (
              <tr
                key={version.discogsId}
                className="border-t border-stone-200 dark:border-stone-900"
              >
                <td className="py-2 pr-4">
                  <Link
                    to={`/app/releases/${version.discogsId}`}
                    state={{ from: `/app/masters/${discogsId}?page=${page}` }}
                    className="font-medium text-stone-900 no-underline hover:text-primary dark:text-stone-100"
                  >
                    {version.title}
                  </Link>
                </td>
                <td className="py-2 pr-4 text-stone-500 dark:text-stone-400">
                  {version.format ?? '—'}
                </td>
                <td className="py-2 pr-4 text-stone-500 dark:text-stone-400">
                  {version.year ?? '—'}
                </td>
                <td className="py-2 pr-4 text-stone-500 dark:text-stone-400">
                  {version.label ?? '—'}
                </td>
                <td className="py-2 pr-4 text-stone-500 dark:text-stone-400">
                  {version.country ?? '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {pagination.pages > 1 && (
        <div className="flex gap-3">
          <Button
            variant="secondary"
            disabled={page <= 1}
            onClick={() => onPageChange(page - 1)}
          >
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
