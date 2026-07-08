import type { Article } from '../services/feedsApi';
import { Badge } from './ui/Badge';
import { Card } from './ui/Card';

function formatPublishedAt(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

interface FeedArticleCardProps {
  article: Article;
}

export function FeedArticleCard({ article }: FeedArticleCardProps) {
  return (
    <Card padding="sm">
      <a
        href={article.link}
        target="_blank"
        rel="noopener noreferrer"
        className="flex flex-col gap-2 no-underline"
      >
        {article.imageUrl ? (
          <img
            src={article.imageUrl}
            alt={article.title}
            className="aspect-video w-full rounded-md object-cover"
          />
        ) : (
          <div
            data-testid="feed-article-thumbnail-placeholder"
            className="aspect-video w-full rounded-md bg-gray-100 dark:bg-gray-800"
          />
        )}
        <div className="flex items-center gap-2">
          <Badge>{article.category}</Badge>
          <span className="text-xs text-gray-500 dark:text-gray-400">
            {article.sourceName} · {formatPublishedAt(article.publishedAt)}
          </span>
        </div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{article.title}</h3>
        <p className="text-sm text-gray-600 dark:text-gray-300">{article.excerpt}</p>
      </a>
    </Card>
  );
}
