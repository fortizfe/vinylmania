export interface FeedSourceConfig {
  id: string;
  name: string;
  feedUrl: string;
  category: string;
  enabled: boolean;
  /** Governs source-filter display order only (priority sources listed first); no effect on card size, article ordering, or prominence. */
  priority: boolean;
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
  priority: boolean;
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

/** All articles for one source, uncapped — spec 041 FR-008. */
export interface SourceFeedResponse {
  sourceId: string;
  sourceName: string;
  status: SourceHealth;
  articles: Article[];
  generatedAt: string;
}
