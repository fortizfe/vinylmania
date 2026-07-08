import { Card } from './ui/Card';
import { Skeleton } from './ui/Skeleton';

export function FeedArticleCardSkeleton() {
  return (
    <div data-testid="feed-article-card-skeleton">
      <Card padding="sm" className="flex flex-col gap-2">
        <Skeleton className="h-4 w-1/3" />
        <Skeleton className="h-5 w-3/4" />
        <Skeleton className="h-3 w-full" />
      </Card>
    </div>
  );
}
