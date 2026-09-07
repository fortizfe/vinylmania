import { Card } from './ui/Card';
import { Skeleton } from './ui/Skeleton';

/**
 * Loading placeholder for the master-release detail view (feature 063,
 * FR-023 / contracts/ui-contracts.md §C9).
 *
 * Feature 063 reworked the shared `recordDetail/RecordDetailSkeleton` into the
 * new release/library rail layout. The master page is explicitly out of scope
 * for that redesign, so it keeps this pre-063 single-card skeleton shape — its
 * loading visual (and `MasterReleaseDetailPage.test.tsx`) stay unchanged. The
 * `data-testid` is preserved so existing selectors keep matching.
 */
export function MasterReleaseDetailSkeleton() {
  return (
    <Card>
      <div
        data-testid="record-detail-skeleton"
        className="grid grid-cols-1 gap-6 lg:grid-cols-2 xl:grid-cols-3"
      >
        <Skeleton className="aspect-square w-full lg:col-span-2 xl:col-span-1" />

        <div className="grid grid-cols-1 gap-4 lg:col-span-2 lg:grid-cols-2 xl:col-span-2">
          <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-3">
              <Skeleton className="h-7 w-2/3" />
              <Skeleton className="h-4 w-1/3" />
            </div>
            <div className="flex flex-col gap-3">
              <Skeleton className="h-5 w-24" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full" />
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <Skeleton className="h-5 w-1/3" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-2/3" />
          </div>
        </div>

        <Skeleton className="h-16 w-full lg:col-span-2 xl:col-span-3" />
      </div>
    </Card>
  );
}
