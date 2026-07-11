import { FeedArticleBoard } from '../components/FeedArticleBoard';
import { FeedArticleCardSkeleton } from '../components/FeedArticleCardSkeleton';
import { FeedSourceStatusBanner } from '../components/FeedSourceStatusBanner';
import { useDashboardFeeds } from '../queries/feedsQueries';

const SKELETON_COUNT = 10;

export function DashboardPage() {
  const { data, isLoading } = useDashboardFeeds();

  const categories = data?.categories ?? [];
  const sourceStatuses = data?.sourceStatuses ?? [];

  function renderContent() {
    if (isLoading) {
      return (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {Array.from({ length: SKELETON_COUNT }).map((_, index) => (
            <FeedArticleCardSkeleton key={index} />
          ))}
        </div>
      );
    }

    return <FeedArticleBoard categories={categories} sourceStatuses={sourceStatuses} />;
  }

  return (
    <main className="mx-auto flex max-w-7xl flex-col gap-6 p-6 sm:p-8">
      <FeedSourceStatusBanner sourceStatuses={sourceStatuses} />
      {renderContent()}
    </main>
  );
}
