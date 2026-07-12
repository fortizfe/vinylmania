import { Card } from './ui/Card';
import { Skeleton } from './ui/Skeleton';

export function SearchResultCardSkeleton() {
  return (
    <div data-testid="search-result-card-skeleton">
      <Card padding="sm" className="flex flex-col gap-2 sm:h-96">
        <Skeleton className="aspect-square w-full" />
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-3 w-1/2" />
        <Skeleton className="h-3 w-1/4" />
      </Card>
    </div>
  );
}
