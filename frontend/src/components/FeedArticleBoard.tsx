import { useMemo, useState } from 'react';

import { useSourceFeed } from '../queries/feedsQueries';
import type { CategoryGroup, SourceStatus } from '../services/feedsApi';
import { FeedArticleCard } from './FeedArticleCard';
import { FeedArticleCardSkeleton } from './FeedArticleCardSkeleton';
import { FeedCategoryFilterBar } from './FeedCategoryFilterBar';
import { FeedSourceFilterBar } from './FeedSourceFilterBar';

const SOURCE_SKELETON_COUNT = 5;

interface FeedArticleBoardProps {
  categories: CategoryGroup[];
  sourceStatuses: SourceStatus[];
}

export function FeedArticleBoard({ categories, sourceStatuses }: FeedArticleBoardProps) {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedSource, setSelectedSource] = useState<string | null>(null);

  const { data: sourceFeed, isLoading: isSourceFeedLoading } = useSourceFeed(selectedSource);

  const aggregatedArticles = useMemo(() => {
    return categories
      .flatMap((group) => group.articles)
      .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());
  }, [categories]);

  const categoryNames = categories.map((group) => group.category);

  function renderContent() {
    if (selectedSource) {
      if (isSourceFeedLoading) {
        return (
          <div
            data-testid="feed-article-grid"
            className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5"
          >
            {Array.from({ length: SOURCE_SKELETON_COUNT }).map((_, index) => (
              <FeedArticleCardSkeleton key={index} />
            ))}
          </div>
        );
      }

      if (sourceFeed?.status === 'unavailable') {
        return (
          <p className="text-stone-500 dark:text-stone-400">
            {sourceFeed.sourceName} is temporarily unavailable right now.
          </p>
        );
      }

      const sourceArticles = (sourceFeed?.articles ?? []).filter(
        (article) => !selectedCategory || article.category === selectedCategory,
      );

      return renderArticles(sourceArticles);
    }

    const visibleArticles = aggregatedArticles.filter(
      (article) => !selectedCategory || article.category === selectedCategory,
    );

    return renderArticles(visibleArticles);
  }

  function renderArticles(articles: CategoryGroup['articles']) {
    if (articles.length === 0) {
      return (
        <p className="text-stone-500 dark:text-stone-400">
          No news right now — check back soon.
        </p>
      );
    }

    return (
      <div
        data-testid="feed-article-grid"
        className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5"
      >
        {articles.map((article) => (
          <FeedArticleCard key={article.id} article={article} />
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 sm:gap-6">
      <div className="sticky top-0 z-10 flex flex-col gap-2 bg-white py-2 dark:bg-surface">
        <FeedCategoryFilterBar
          categories={categoryNames}
          selectedCategory={selectedCategory}
          onSelectCategory={setSelectedCategory}
        />
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
