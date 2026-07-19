import type { Article, FeedSourceConfig, RawFeedItem } from './types';

const EXCERPT_MAX_LENGTH = 200;
const SAFE_IMAGE_URL_PATTERN = /^https?:\/\//i;
const IMG_SRC_PATTERN = /<img[^>]+src=["']([^"']+)["']/i;

const ENTITY_PATTERN = /&#(\d+);|&amp;|&lt;|&gt;|&quot;|&apos;/g;

// Single combined-pass regex, resolved through one callback: String.replace
// never re-scans a match's own replacement text, so a numeric reference that
// decodes to '&' (e.g. &#38;) can never be re-interpreted as the start of a
// second entity — which is exactly what let a feed double-encode a
// <script> fragment (&#38;lt;script&#38;gt;) past the old sequential
// .replace().replace()... chain, since that chain fed each pass's output
// into the next pass's input (spec 056 FR-002).
function decodeEntities(input: string): string {
  return input.replace(ENTITY_PATTERN, (match: string, numericCode?: string) => {
    if (numericCode !== undefined) {
      return String.fromCharCode(Number(numericCode));
    }
    switch (match) {
      case '&amp;':
        return '&';
      case '&lt;':
        return '<';
      case '&gt;':
        return '>';
      case '&quot;':
        return '"';
      default:
        return "'"; // &apos;
    }
  });
}

// Stripped to a fixed point (looping until a pass makes no further change)
// rather than a single replace pass, so removing an outer tag can never
// reveal a new tag formed by the leftover fragments (e.g. "<<img>>" or
// "<scr<script>ipt>") — the exact gap CodeQL's incomplete multi-character
// sanitization check flags in one-shot regex stripping.
function stripHtml(input: string): string {
  let previous: string;
  let current = input;
  do {
    previous = current;
    current = previous.replace(/<[^>]*>/g, '');
  } while (current !== previous);
  return current;
}

// Feed content is never rendered as HTML (research.md §2) — this always
// reduces titles/excerpts to inert plain text, satisfying FR-008 by
// construction rather than by an allow-list sanitizer. Decoding runs before
// stripping (not after) so a tag that only exists in entity-encoded form
// (e.g. &#38;lt;script&#38;gt;) is still subject to stripHtml once decoded,
// instead of sailing through stripHtml untouched and only becoming a real
// tag afterward.
function cleanText(raw: string | undefined): string {
  if (!raw) {
    return '';
  }
  return stripHtml(decodeEntities(raw)).replace(/\s+/g, ' ').trim();
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
