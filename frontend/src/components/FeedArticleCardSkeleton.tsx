import {
  feedCardLayout,
  feedCardMedia,
  type FeedArticleCardVariant,
} from '../lib/newsLayout';
import { Skeleton } from './ui/Skeleton';

interface FeedArticleCardSkeletonProps {
  variant?: FeedArticleCardVariant;
}

export function FeedArticleCardSkeleton({
  variant = 'tile',
}: FeedArticleCardSkeletonProps) {
  return (
    <div
      data-testid="feed-article-card-skeleton"
      data-variant={variant}
      className={feedCardLayout[variant]}
    >
      <Skeleton className={feedCardMedia[variant]} />
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <Skeleton className={variant === 'lead' ? 'h-7 w-11/12' : 'h-4 w-full'} />
        <Skeleton className={variant === 'lead' ? 'h-7 w-2/3' : 'h-4 w-2/3'} />
        <Skeleton className="h-3 w-1/3" />
      </div>
    </div>
  );
}
