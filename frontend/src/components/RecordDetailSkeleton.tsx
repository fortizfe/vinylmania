import { Card } from './ui/Card';
import { Skeleton } from './ui/Skeleton';

export function RecordDetailSkeleton() {
  return (
    <Card>
      <div
        data-testid="record-detail-skeleton"
        className="grid grid-cols-1 gap-6 lg:grid-cols-2"
      >
        <Skeleton className="aspect-square w-full lg:col-span-2" />

        <div className="grid grid-cols-1 gap-4 lg:col-span-2 lg:grid-cols-2">
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

        <Skeleton className="h-16 w-full lg:col-span-2" />
      </div>
    </Card>
  );
}
