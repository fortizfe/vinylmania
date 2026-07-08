import { Skeleton } from './ui/Skeleton';

export function MasterVersionsTableSkeleton() {
  return (
    <div data-testid="master-versions-table-skeleton" className="flex flex-col gap-3">
      <Skeleton className="h-5 w-24" />
      <div className="flex flex-col gap-2">
        {Array.from({ length: 10 }, (_, index) => (
          <Skeleton key={index} className="h-8 w-full" />
        ))}
      </div>
    </div>
  );
}
