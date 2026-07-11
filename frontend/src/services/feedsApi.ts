import { authorizedFetch } from './apiClient';

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

export interface CategoryGroup {
  category: string;
  articles: Article[];
}

export type SourceHealth = 'ok' | 'unavailable';

export interface SourceStatus {
  sourceId: string;
  sourceName: string;
  status: SourceHealth;
  priority: boolean;
}

export interface DashboardResponse {
  categories: CategoryGroup[];
  sourceStatuses: SourceStatus[];
  generatedAt: string;
}

export async function getDashboard(): Promise<DashboardResponse> {
  const res = await authorizedFetch('/api/feeds/dashboard');
  return res.json();
}
