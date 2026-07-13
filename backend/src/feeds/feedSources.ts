import type { FeedSourceConfig } from './types';

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
  // Metal Blade Records (https://www.metalblade.com/us/feed/ and variants)
  // was evaluated as a candidate source and confirmed persistently
  // unreachable (no response across 3 URL variants, verified live during
  // feature 041 planning — research.md §1). It is intentionally excluded
  // rather than added disabled — see spec 041 FR-006.
  {
    id: 'heavy-mag',
    name: 'Heavy Mag',
    feedUrl: 'https://heavymag.com.au/feed/',
    category: 'News',
    enabled: true,
    priority: false,
  },
  {
    id: 'metal-underground',
    name: 'Metal Underground',
    feedUrl: 'https://feeds.feedburner.com/metalunderground',
    category: 'News',
    enabled: true,
    priority: false,
  },
  {
    id: 'heavy-metal-overload',
    name: 'Heavy Metal Overload',
    feedUrl: 'https://heavymetaloverload.com/feed/',
    category: 'News',
    enabled: true,
    priority: false,
  },
  {
    id: 'femme-metal',
    name: 'Femme Metal',
    feedUrl: 'https://femmetal.rocks/feed/',
    category: 'News',
    enabled: true,
    priority: false,
  },
  {
    id: 'metaltalk',
    name: 'MetalTalk',
    feedUrl: 'https://www.metaltalk.net/feed',
    category: 'News',
    enabled: true,
    priority: false,
  },
];
