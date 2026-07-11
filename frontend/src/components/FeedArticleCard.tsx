import type { Article } from '../services/feedsApi';
import { Badge } from './ui/Badge';
import { Card } from './ui/Card';

function formatPublishedAt(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

interface FeedArticleCardProps {
  article: Article;
}

export function FeedArticleCard({ article }: FeedArticleCardProps) {
  return (
    <Card padding="sm" className="h-40 overflow-hidden sm:h-96">
      <a
        href={article.link}
        target="_blank"
        rel="noopener noreferrer"
        className="flex h-full flex-row gap-3 no-underline sm:flex-col sm:gap-2"
      >
        {article.imageUrl ? (
          <img
            src={article.imageUrl}
            alt={article.title}
            className="h-full w-24 shrink-0 self-stretch rounded-md object-cover sm:aspect-video sm:h-auto sm:w-full"
          />
        ) : (
          <div
            data-testid="feed-article-thumbnail-placeholder"
            className="h-full w-24 shrink-0 self-stretch rounded-md bg-gray-100 dark:bg-gray-900 sm:aspect-video sm:h-auto sm:w-full"
          />
        )}
        <div className="flex min-w-0 flex-1 flex-col gap-1 sm:gap-2">
          <div className="flex items-center gap-2">
            <Badge>{article.category}</Badge>
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {article.sourceName} · {formatPublishedAt(article.publishedAt)}
            </span>
          </div>
          <h3 className="line-clamp-2 text-lg font-semibold text-gray-900 dark:text-gray-100">
            {article.title}
          </h3>
          <p className="line-clamp-1 text-sm text-gray-600 sm:line-clamp-2 dark:text-gray-300">
            {article.excerpt}
          </p>
        </div>
      </a>
    </Card>
  );
}
