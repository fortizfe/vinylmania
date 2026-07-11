import { Card } from './ui/Card';
import { Skeleton } from './ui/Skeleton';

export function FeedArticleCardSkeleton() {
  return (
    <div data-testid="feed-article-card-skeleton">
      <Card padding="sm" className="h-40 overflow-hidden sm:h-96">
        <div className="flex h-full flex-row gap-3 sm:flex-col sm:gap-2">
          <Skeleton className="h-full w-24 shrink-0 self-stretch rounded-md sm:aspect-video sm:h-auto sm:w-full" />
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-5 w-3/4" />
            <Skeleton className="h-3 w-full" />
          </div>
        </div>
      </Card>
    </div>
  );
}
