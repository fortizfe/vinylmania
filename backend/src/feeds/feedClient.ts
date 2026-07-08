import axios from 'axios';
import Parser from 'rss-parser';

const DEFAULT_TIMEOUT_MS = 8_000;

const parser = new Parser();

/** Fetches one feed URL and parses it into RSS/Atom items, bounded by an independent timeout per source (spec FR-007). */
export async function fetchFeed(
  feedUrl: string,
  timeoutMs: number = DEFAULT_TIMEOUT_MS,
): Promise<Parser.Output<Record<string, unknown>>> {
  const response = await axios.get<string>(feedUrl, {
    timeout: timeoutMs,
    responseType: 'text',
    headers: {
      'User-Agent': 'Vinylmania/0.1 (+https://vinylmania.app; RSS dashboard aggregator)',
    },
  });

  return parser.parseString(response.data);
}
