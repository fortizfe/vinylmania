export interface FeedSourceConfig {
  id: string;
  name: string;
  feedUrl: string;
  category: string;
  enabled: boolean;
}

export interface Article {
  id: string;
  title: string;
  excerpt: string;
  imageUrl?: string;
  publishedAt: string;
  link: string;
  sourceId: string;
  sourceName: string;
  category: string;
}

export type SourceHealth = 'ok' | 'unavailable';

export interface SourceStatus {
  sourceId: string;
  sourceName: string;
  status: SourceHealth;
}

export interface CategoryGroup {
  category: string;
  articles: Article[];
}

export interface DashboardResponse {
  categories: CategoryGroup[];
  sourceStatuses: SourceStatus[];
  generatedAt: string;
}
