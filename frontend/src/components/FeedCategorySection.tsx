import type { Article } from '../services/feedsApi';
import { FeedArticleCard } from './FeedArticleCard';

interface FeedCategorySectionProps {
  category: string;
  articles: Article[];
}

export function FeedCategorySection({ category, articles }: FeedCategorySectionProps) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">{category}</h2>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {articles.map((article) => (
          <FeedArticleCard key={article.id} article={article} />
        ))}
      </div>
    </section>
  );
}
