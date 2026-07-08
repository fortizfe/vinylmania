import type { FeedSourceConfig } from './types';

// Metal Storm's feed-listing page (metalstorm.net/home/rss.php) returns a
// Cloudflare managed-challenge (403, cf-mitigated: challenge) to server-side
// requests, so its individual category feed URLs could not be enumerated
// (research.md §3). Shipped disabled per the feature's Clarifications: the
// MVP launches with Metal Injection only and Metal Storm is a fast-follow
// once a viable fetch strategy exists.
export const FEED_SOURCES: FeedSourceConfig[] = [
  {
    id: 'metal-injection',
    name: 'Metal Injection',
    feedUrl: 'https://metalinjection.net/feed',
    category: 'News',
    enabled: true,
  },
  {
    id: 'metal-storm',
    name: 'Metal Storm',
    feedUrl: 'https://metalstorm.net/home/rss.php',
    category: 'News',
    enabled: false,
  },
];
