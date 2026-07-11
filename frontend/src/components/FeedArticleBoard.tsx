import { useMemo, useState } from 'react';

import type { CategoryGroup, SourceStatus } from '../services/feedsApi';
import { FeedArticleCard } from './FeedArticleCard';
import { FeedCategoryFilterBar } from './FeedCategoryFilterBar';
import { FeedSourceFilterBar } from './FeedSourceFilterBar';

interface FeedArticleBoardProps {
  categories: CategoryGroup[];
  sourceStatuses: SourceStatus[];
}

export function FeedArticleBoard({ categories, sourceStatuses }: FeedArticleBoardProps) {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedSource, setSelectedSource] = useState<string | null>(null);

  const sortedArticles = useMemo(() => {
    return categories
      .flatMap((group) => group.articles)
      .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());
  }, [categories]);

  const visibleArticles = sortedArticles.filter((article) => {
    if (selectedCategory && article.category !== selectedCategory) {
      return false;
    }
    if (selectedSource && article.sourceId !== selectedSource) {
      return false;
    }
    return true;
  });

  const categoryNames = categories.map((group) => group.category);

  return (
    <div className="flex flex-col gap-4 sm:gap-6">
      <div className="sticky top-0 z-10 flex flex-col gap-2 bg-white py-2 dark:bg-gray-950">
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
      {visibleArticles.length === 0 ? (
        <p className="text-gray-500 dark:text-gray-400">
          No news right now — check back soon.
        </p>
      ) : (
        <div
          data-testid="feed-article-grid"
          className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5"
        >
          {visibleArticles.map((article) => (
            <FeedArticleCard key={article.id} article={article} />
          ))}
        </div>
      )}
    </div>
  );
}
