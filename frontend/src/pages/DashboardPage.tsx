import { useState } from 'react';

import { FeedArticleCardSkeleton } from '../components/FeedArticleCardSkeleton';
import { FeedCategoryFilterBar } from '../components/FeedCategoryFilterBar';
import { FeedCategorySection } from '../components/FeedCategorySection';
import { FeedSourceStatusBanner } from '../components/FeedSourceStatusBanner';
import { useDashboardFeeds } from '../queries/feedsQueries';

const SKELETON_COUNT = 5;

export function DashboardPage() {
  const { data, isLoading } = useDashboardFeeds();
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const categories = data?.categories ?? [];
  const sourceStatuses = data?.sourceStatuses ?? [];
  const visibleCategories = selectedCategory
    ? categories.filter((group) => group.category === selectedCategory)
    : categories;

  function renderContent() {
    if (isLoading) {
      return (
        <div className="flex flex-col gap-4">
          {Array.from({ length: SKELETON_COUNT }).map((_, index) => (
            <FeedArticleCardSkeleton key={index} />
          ))}
        </div>
      );
    }

    if (categories.length === 0) {
      return (
        <p className="text-gray-500 dark:text-gray-400">
          No news right now — check back soon.
        </p>
      );
    }

    return (
      <>
        <FeedCategoryFilterBar
          categories={categories.map((group) => group.category)}
          selectedCategory={selectedCategory}
          onSelectCategory={setSelectedCategory}
        />
        <div className="flex flex-col gap-8">
          {visibleCategories.map((group) => (
            <FeedCategorySection
              key={group.category}
              category={group.category}
              articles={group.articles}
            />
          ))}
        </div>
      </>
    );
  }

  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-6 p-6 sm:p-8">
      <FeedSourceStatusBanner sourceStatuses={sourceStatuses} />
      {renderContent()}
    </main>
  );
}
