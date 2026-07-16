import axios from 'axios';
import Parser from 'rss-parser';

import type { RawFeedItem } from '../../domain/feeds/types';
import type { FeedSourcePort } from '../../ports/feeds/feedSourcePort';

const DEFAULT_TIMEOUT_MS = 8_000;

const parser = new Parser();

/** Fetches one feed URL and parses it into domain-owned RawFeedItems, bounded by an independent timeout per source (spec FR-005). */
export async function fetchFeed(
  feedUrl: string,
  timeoutMs: number = DEFAULT_TIMEOUT_MS,
): Promise<RawFeedItem[]> {
  const response = await axios.get<string>(feedUrl, {
    timeout: timeoutMs,
    responseType: 'text',
    headers: {
      'User-Agent': 'Vinylmania/0.1 (+https://vinylmania.app; RSS dashboard aggregator)',
    },
  });

  const feed = await parser.parseString(response.data);

  return feed.items.map((item) => ({
    title: item.title,
    link: item.link,
    guid: item.guid,
    isoDate: item.isoDate,
    pubDate: item.pubDate,
    content: item.content,
    contentSnippet: item.contentSnippet,
    summary: item.summary,
    enclosureUrl: item.enclosure?.url,
  }));
}

export const feedSourceAdapter: FeedSourcePort = { fetchFeed };
