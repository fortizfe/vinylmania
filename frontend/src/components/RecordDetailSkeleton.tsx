import { Card } from './ui/Card';
import { Skeleton } from './ui/Skeleton';

export function RecordDetailSkeleton() {
  return (
    <div data-testid="record-detail-skeleton" className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <div className="lg:col-span-2">
        <Card className="overflow-hidden p-0" padding="sm">
          <Skeleton className="aspect-square w-full sm:aspect-video" rounded="md" />
        </Card>
      </div>

      <div className="flex flex-col gap-6">
        <Card>
          <Skeleton className="mb-3 h-7 w-2/3" />
          <Skeleton className="h-4 w-1/3" />
        </Card>

        <Card>
          <Skeleton className="mb-3 h-5 w-24" />
          <div className="flex flex-col gap-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-2/3" />
          </div>
        </Card>
      </div>

      <div>
        <Card>
          <Skeleton className="mb-3 h-5 w-24" />
          <div className="flex flex-col gap-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-2/3" />
          </div>
        </Card>
      </div>
    </div>
  );
}
