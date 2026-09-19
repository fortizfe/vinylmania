import { useEffect, useId, useMemo, useRef, useState } from 'react';

import { assignPortadaSlots } from '../lib/newsLayout';
import { useSourceFeed } from '../queries/feedsQueries';
import type { Article, CategoryGroup, SourceStatus } from '../services/feedsApi';
import { FeedArticleCard } from './FeedArticleCard';
import { FeedArticleCardSkeleton } from './FeedArticleCardSkeleton';
import { FeedSourceFilterBar } from './FeedSourceFilterBar';

// Portada grid (plan.md "UI decisions"): phone = lead, then 2×2 tiles, then a
// one-column Latest; lg = lead in 7 of 12 columns beside the 2×2 tiles, and a
// two-column Latest. Shared by the loaded view and PortadaSkeleton.
const topGridClassName = 'grid gap-5 lg:grid-cols-12 lg:gap-8';
const leadCellClassName = 'lg:col-span-7';
const tileGridClassName = 'grid grid-cols-2 content-start gap-x-4 gap-y-5 lg:col-span-5';
const latestListClassName = 'grid gap-4 lg:grid-cols-2 lg:gap-x-8 lg:gap-y-5';

const SKELETON_TILES = 4;
const SKELETON_ROWS = 6;

export function PortadaSkeleton() {
  return (
    <div className="flex flex-col gap-8">
      <div className={topGridClassName}>
        <div className={leadCellClassName}>
          <FeedArticleCardSkeleton variant="lead" />
        </div>
        <div className={tileGridClassName}>
          {Array.from({ length: SKELETON_TILES }, (_, i) => (
            <FeedArticleCardSkeleton key={i} variant="tile" />
          ))}
        </div>
      </div>
      <div className={latestListClassName}>
        {Array.from({ length: SKELETON_ROWS }, (_, i) => (
          <FeedArticleCardSkeleton key={i} variant="row" />
        ))}
      </div>
    </div>
  );
}

function Portada({ articles }: { articles: Article[] }) {
  const topId = useId();
  const latestId = useId();
  const { lead, secondary, latest } = assignPortadaSlots(articles);

  return (
    <div className="flex flex-col gap-8">
      {lead && (
        <section aria-labelledby={topId}>
          <h2 id={topId} className="sr-only">
            Top stories
          </h2>
          <div className={topGridClassName}>
            <div className={leadCellClassName}>
              <FeedArticleCard article={lead} variant="lead" />
            </div>
            {secondary.length > 0 && (
              <div className={tileGridClassName}>
                {secondary.map((article) => (
                  <FeedArticleCard key={article.id} article={article} variant="tile" />
                ))}
              </div>
            )}
          </div>
        </section>
      )}
      {latest.length > 0 && (
        <section aria-labelledby={latestId} className="flex flex-col gap-4">
          <h2
            id={latestId}
            className="text-lg font-semibold text-stone-900 dark:text-stone-100"
          >
            Latest
          </h2>
          <ul className={latestListClassName}>
            {latest.map((article) => (
              <li key={article.id}>
                <FeedArticleCard article={article} variant="row" />
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

interface FeedArticleBoardProps {
  categories: CategoryGroup[];
  sourceStatuses: SourceStatus[];
}

export function FeedArticleBoard({ categories, sourceStatuses }: FeedArticleBoardProps) {
  const [selectedSource, setSelectedSource] = useState<string | null>(null);
  const chipBarRef = useRef<HTMLDivElement>(null);

  // Keyboard focus must scroll clear of the sticky header + chip bar
  // (WCAG 2.4.11). The bar wraps to more rows from sm up, so CSS can't know
  // its height; measure it and pad the page's scroll by both.
  useEffect(() => {
    const bar = chipBarRef.current;
    if (!bar || typeof ResizeObserver === 'undefined') return;
    const root = document.documentElement;
    const observer = new ResizeObserver(() => {
      root.style.scrollPaddingTop = `calc(var(--header-h) + ${bar.offsetHeight}px)`;
    });
    observer.observe(bar);
    return () => {
      observer.disconnect();
      root.style.scrollPaddingTop = '';
    };
  }, []);

  const { data: sourceFeed, isLoading: isSourceFeedLoading } =
    useSourceFeed(selectedSource);

  const allArticles = useMemo(
    () => categories.flatMap((group) => group.articles),
    [categories],
  );

  function renderContent() {
    if (selectedSource) {
      if (isSourceFeedLoading) {
        return <PortadaSkeleton />;
      }

      if (sourceFeed?.status === 'unavailable') {
        return (
          <p className="text-stone-600 dark:text-stone-400">
            {sourceFeed.sourceName} is temporarily unavailable right now.
          </p>
        );
      }

      return renderArticles(sourceFeed?.articles ?? []);
    }

    return renderArticles(allArticles);
  }

  function renderArticles(articles: Article[]) {
    if (articles.length === 0) {
      return (
        <p className="text-stone-600 dark:text-stone-400">
          No news right now — check back soon.
        </p>
      );
    }

    // No transition on filter change: content swaps instantly (FR-017).
    return <Portada articles={articles} />;
  }

  return (
    <div className="flex flex-col gap-4 sm:gap-6">
      <div
        ref={chipBarRef}
        className="sticky top-(--header-h) z-10 bg-white py-2 dark:bg-surface"
      >
        <FeedSourceFilterBar
          sourceStatuses={sourceStatuses}
          selectedSource={selectedSource}
          onSelectSource={setSelectedSource}
        />
      </div>
      {renderContent()}
    </div>
  );
}
