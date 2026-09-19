import clsx from 'clsx';
import { useId, useState } from 'react';

import {
  feedCardLayout,
  feedCardMedia,
  formatArticleAge,
  sourceMonogram,
  type FeedArticleCardVariant,
} from '../lib/newsLayout';
import type { Article } from '../services/feedsApi';
import { focusRing } from './ui/focusRing';
import { pressableCard } from './ui/press';

const titleClassName = {
  lead: 'line-clamp-3 font-display text-2xl leading-display tracking-display lg:text-4xl',
  tile: 'line-clamp-3 text-base font-semibold',
  row: 'line-clamp-2 text-sm font-semibold sm:text-base',
} as const;

interface FeedArticleCardProps {
  article: Article;
  variant?: FeedArticleCardVariant;
}

export function FeedArticleCard({ article, variant = 'tile' }: FeedArticleCardProps) {
  const [failed, setFailed] = useState(false);
  const titleId = useId();
  const metaId = useId();
  const isLead = variant === 'lead';
  const published = new Date(article.publishedAt);
  const fullDate = published.toLocaleDateString('en', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <article>
      <a
        href={article.link}
        target="_blank"
        rel="noopener noreferrer"
        aria-labelledby={titleId}
        aria-describedby={metaId}
        className={clsx(
          'group rounded-xl no-underline',
          feedCardLayout[variant],
          focusRing,
          pressableCard,
        )}
      >
        <div className={clsx('relative overflow-hidden', feedCardMedia[variant])}>
          {article.imageUrl && !failed ? (
            <img
              src={article.imageUrl}
              alt=""
              decoding="async"
              loading={isLead ? 'eager' : 'lazy'}
              fetchPriority={isLead ? 'high' : undefined}
              referrerPolicy="no-referrer"
              onError={() => setFailed(true)}
              className="h-full w-full object-cover"
            />
          ) : (
            <div
              data-testid="feed-article-thumbnail-placeholder"
              aria-hidden="true"
              className="flex h-full w-full items-center justify-center bg-stone-100 text-xl font-semibold tracking-tight text-stone-600 select-none dark:bg-stone-800 dark:text-stone-300"
            >
              {sourceMonogram(article.sourceName)}
            </div>
          )}
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <h3
            id={titleId}
            className={clsx(
              'text-stone-900 decoration-2 underline-offset-2 group-hover:underline dark:text-stone-100',
              titleClassName[variant],
            )}
          >
            {article.title}
          </h3>
          {isLead && (
            <p className="hidden text-sm text-stone-600 sm:line-clamp-2 dark:text-stone-300">
              {article.excerpt}
            </p>
          )}
          <p id={metaId} className="text-xs text-stone-600 dark:text-stone-400">
            {article.sourceName} ·{' '}
            <time dateTime={article.publishedAt} title={fullDate}>
              {formatArticleAge(article.publishedAt, new Date())}
              <span className="sr-only">, {fullDate}</span>
            </time>
          </p>
        </div>
      </a>
    </article>
  );
}
