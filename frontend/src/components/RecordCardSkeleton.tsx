import { Card } from './ui/Card';
import { Skeleton } from './ui/Skeleton';

export function RecordCardSkeleton() {
  return (
    <li data-testid="record-card-skeleton">
      <Card padding="sm" className="flex flex-col gap-2">
        <Skeleton className="aspect-square w-full" />
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-3 w-1/2" />
      </Card>
    </li>
  );
}
