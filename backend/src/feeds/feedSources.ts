import type { FeedSourceConfig } from './types';

// Metal Storm's general feed-listing page (metalstorm.net/home/rss.php) was
// Cloudflare-challenge-protected and unusable (research.md §3, feature 024).
// These direct per-category RSS/XML endpoints are unaffected by that
// restriction — verified reachable (200, application/rss+xml, valid XML,
// no Cloudflare challenge) during feature 025's implementation (research.md
// §4). "News" intentionally shares its category with `metal-injection`
// below so their articles merge into one "News" category (spec 025 FR-004).
export const FEED_SOURCES: FeedSourceConfig[] = [
  {
    id: 'metal-injection',
    name: 'Metal Injection',
    feedUrl: 'https://metalinjection.net/feed',
    category: 'News',
    enabled: true,
    priority: true,
  },
  // Verified reachable (200, text/xml, valid RSS 2.0 XML, no Cloudflare
  // challenge) during feature 033's planning research (research.md §6).
  {
    id: 'metalsucks',
    name: 'MetalSucks',
    feedUrl: 'https://feeds.feedburner.com/Metalsucks',
    category: 'News',
    enabled: true,
    priority: true,
  },
  {
    id: 'louder-sound',
    name: 'Louder Sound',
    feedUrl: 'https://www.loudersound.com/feeds.xml',
    category: 'News',
    enabled: true,
    priority: true,
  },
  {
    id: 'metal-storm-news',
    name: 'Metal Storm',
    feedUrl: 'https://metalstorm.net/rss/news.xml',
    category: 'News',
    enabled: true,
    priority: false,
  },
  {
    id: 'metal-storm-reviews',
    name: 'Metal Storm',
    feedUrl: 'https://metalstorm.net/rss/reviews.xml',
    category: 'Reviews',
    enabled: true,
    priority: false,
  },
  {
    id: 'metal-storm-interviews',
    name: 'Metal Storm',
    feedUrl: 'https://metalstorm.net/rss/interviews.xml',
    category: 'Interviews',
    enabled: true,
    priority: false,
  },
  {
    id: 'metal-storm-articles',
    name: 'Metal Storm',
    feedUrl: 'https://metalstorm.net/rss/articles.xml',
    category: 'Articles',
    enabled: true,
    priority: false,
  },
  {
    id: 'metal-storm-picks',
    name: 'Metal Storm',
    feedUrl: 'https://metalstorm.net/rss/picks.xml',
    category: 'Staff Picks',
    enabled: true,
    priority: false,
  },
];
