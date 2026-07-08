import type { Article } from '../services/feedsApi';
import { FeedArticleCard } from './FeedArticleCard';
import { FeedCarousel } from './FeedCarousel';

interface FeedCategorySectionProps {
  category: string;
  articles: Article[];
}

export function FeedCategorySection({ category, articles }: FeedCategorySectionProps) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">{category}</h2>
      <FeedCarousel>
        {articles.map((article) => (
          <FeedArticleCard key={article.id} article={article} />
        ))}
      </FeedCarousel>
    </section>
  );
}
