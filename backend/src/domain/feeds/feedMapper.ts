import type { Article, FeedSourceConfig, RawFeedItem } from './types';

const EXCERPT_MAX_LENGTH = 200;
const SAFE_IMAGE_URL_PATTERN = /^https?:\/\//i;
const IMG_SRC_PATTERN = /<img[^>]+src=["']([^"']+)["']/i;

function decodeEntities(input: string): string {
  return input
    .replace(/&#(\d+);/g, (_match, code: string) => String.fromCharCode(Number(code)))
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'");
}

function stripHtml(input: string): string {
  return input.replace(/<[^>]*>/g, '');
}

// Feed content is never rendered as HTML (research.md §2) — this always
// reduces titles/excerpts to inert plain text, satisfying FR-008 by
// construction rather than by an allow-list sanitizer.
function cleanText(raw: string | undefined): string {
  if (!raw) {
    return '';
  }
  return decodeEntities(stripHtml(raw)).replace(/\s+/g, ' ').trim();
}

function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) {
    return text;
  }
  return `${text.slice(0, maxLength).trimEnd()}…`;
}

/** Only http(s) image URLs are ever accepted — rejects javascript:/data: URIs from a hostile feed. */
function extractImageUrl(item: RawFeedItem): string | undefined {
  const enclosureUrl = item.enclosureUrl;
  if (enclosureUrl && SAFE_IMAGE_URL_PATTERN.test(enclosureUrl)) {
    return enclosureUrl;
  }

  const rawHtml = item.content ?? item.summary ?? '';

  const imgMatch = IMG_SRC_PATTERN.exec(rawHtml);
  if (imgMatch && SAFE_IMAGE_URL_PATTERN.test(imgMatch[1])) {
    return imgMatch[1];
  }

  return undefined;
}

function resolvePublishedAt(item: RawFeedItem): string {
  if (item.isoDate) {
    return item.isoDate;
  }
  if (item.pubDate) {
    const parsed = new Date(item.pubDate);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString();
    }
  }
  return new Date().toISOString();
}

/** Maps one raw parsed feed item to an Article, or drops it (returns undefined) when unusable. */
export function mapFeedItem(
  item: RawFeedItem,
  source: FeedSourceConfig,
): Article | undefined {
  const title = cleanText(item.title);
  const link = item.link?.trim();

  if (!title || !link) {
    return undefined;
  }

  const excerptSource = item.contentSnippet ?? item.content ?? item.summary;
  const excerpt = truncate(cleanText(excerptSource), EXCERPT_MAX_LENGTH);

  return {
    id: item.guid ?? link,
    title,
    excerpt,
    imageUrl: extractImageUrl(item),
    publishedAt: resolvePublishedAt(item),
    link,
    sourceId: source.id,
    sourceName: source.name,
    category: source.category,
  };
}
