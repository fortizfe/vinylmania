import { FeedArticleBoard, PortadaSkeleton } from '../components/FeedArticleBoard';
import { useDashboardFeeds } from '../queries/feedsQueries';

export function DashboardPage() {
  const { data, isLoading } = useDashboardFeeds();

  const categories = data?.categories ?? [];
  const sourceStatuses = data?.sourceStatuses ?? [];

  function renderContent() {
    if (isLoading) {
      return <PortadaSkeleton />;
    }

    if (
      sourceStatuses.length > 0 &&
      sourceStatuses.every((source) => source.status === 'unavailable')
    ) {
      return (
        <p className="text-stone-600 dark:text-stone-400">
          News is temporarily unavailable. Please try again later.
        </p>
      );
    }

    return <FeedArticleBoard categories={categories} sourceStatuses={sourceStatuses} />;
  }

  return (
    <main
      data-testid="dashboard-page"
      className="mx-auto flex max-w-7xl flex-col gap-6 p-6 sm:p-8"
    >
      <h1 className="sr-only">News</h1>
      {renderContent()}
    </main>
  );
}
