import { Card } from './ui/Card';
import { Skeleton } from './ui/Skeleton';

/**
 * Mirrors DiscogsConnectionCard's populated shape (title row, status line,
 * action row) with identical sizing so resolving the status never shifts
 * the layout.
 */
export function DiscogsConnectionCardSkeleton() {
  return (
    <Card>
      <div data-testid="discogs-connection-skeleton" className="flex min-h-36 flex-col gap-4">
        <div className="flex items-center gap-3">
          <Skeleton className="h-10 w-10" rounded="full" />
          <div className="flex flex-col gap-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-3 w-48" />
          </div>
        </div>
        <Skeleton className="h-4 w-36" />
        <Skeleton className="h-9 w-56 rounded-md" />
      </div>
    </Card>
  );
}
