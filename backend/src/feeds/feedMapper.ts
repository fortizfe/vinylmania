import type Parser from 'rss-parser';

import type { Article, FeedSourceConfig } from './types';

const EXCERPT_MAX_LENGTH = 200;
const SAFE_IMAGE_URL_PATTERN = /^https?:\/\//i;
const IMG_SRC_PATTERN = /<img[^>]+src=["']([^"']+)["']/i;
// Metal Storm has no <enclosure>/<img>/Media RSS image data in its feeds —
// its News category instead carries a band/album photo via a non-standard
// data-image-url attribute on <a class="ms-link"> anchors, using a relative
// path (research.md §1). The other Metal Storm categories (Reviews,
// Interviews, Articles, Staff Picks) have no image markup at all, so this
// tier simply won't match for them.
const DATA_IMAGE_URL_PATTERN =
  /<a[^>]+class=["']ms-link["'][^>]*data-image-url=["']([^"']+)["']/i;

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
function extractImageUrl(item: Parser.Item, source: FeedSourceConfig): string | undefined {
  const enclosureUrl = item.enclosure?.url;
  if (enclosureUrl && SAFE_IMAGE_URL_PATTERN.test(enclosureUrl)) {
    return enclosureUrl;
  }

  const rawHtml = item.content ?? item.summary ?? '';

  const imgMatch = IMG_SRC_PATTERN.exec(rawHtml);
  if (imgMatch && SAFE_IMAGE_URL_PATTERN.test(imgMatch[1])) {
    return imgMatch[1];
  }

  const dataImageMatch = DATA_IMAGE_URL_PATTERN.exec(rawHtml);
  if (dataImageMatch) {
    const rawValue = dataImageMatch[1];
    // Reject protocol-relative values before resolving — new URL() would
    // otherwise happily turn "//evil.com/x" into "https://evil.com/x",
    // escaping the source's own host (research.md §3).
    if (!rawValue.startsWith('//')) {
      try {
        const resolved = new URL(rawValue, source.feedUrl).toString();
        if (SAFE_IMAGE_URL_PATTERN.test(resolved)) {
          return resolved;
        }
      } catch {
        // Malformed data-image-url — fall through to undefined.
      }
    }
  }

  return undefined;
}

function resolvePublishedAt(item: Parser.Item): string {
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
  item: Parser.Item,
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
    imageUrl: extractImageUrl(item, source),
    publishedAt: resolvePublishedAt(item),
    link,
    sourceId: source.id,
    sourceName: source.name,
    category: source.category,
  };
}
