import { Card } from './ui/Card';
import { Skeleton } from './ui/Skeleton';

export function RecordListRowSkeleton() {
  return (
    <li data-testid="record-list-row-skeleton">
      <Card padding="sm" className="flex items-center gap-4">
        <Skeleton className="h-16 w-16 shrink-0 sm:h-20 sm:w-20" />
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-3 w-1/2" />
        </div>
      </Card>
    </li>
  );
}
