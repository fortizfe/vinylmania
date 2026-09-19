import type { Article, FeedSourceConfig, RawFeedItem } from './types';

const EXCERPT_MAX_LENGTH = 200;
const SAFE_IMAGE_URL_PATTERN = /^https?:\/\//i;
const IMG_TAG_PATTERN = /<img\b[^>]*>/gi;
const IMG_SRC_ATTR_PATTERN = /\ssrc\s*=\s*["']([^"']+)["']/i;
const IMG_SIZE_ATTR_PATTERN = /\s(?:width|height)\s*=\s*["']?(\d+)/gi;
const MIN_IMG_SIZE_PX = 50;
const IMAGE_EXTENSION_PATTERN = /\.(?:jpe?g|png|gif|webp|avif)(?:[?#]|$)/i;
const META_TAG_PATTERN = /<meta\b[^>]*>/gi;
const META_ATTR_PATTERN = /\s(property|name|content)\s*=\s*(?:"([^"]*)"|'([^']*)')/gi;

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

function safeUrl(url: string | undefined): string | undefined {
  return url && SAFE_IMAGE_URL_PATTERN.test(url) ? url : undefined;
}

function isImageMedia(medium?: string, type?: string): boolean {
  if (!medium && !type) {
    return true; // unlabelled media:content is assumed to be an image
  }
  return medium === 'image' || Boolean(type?.startsWith('image/'));
}

/** First safe `<img src>` that isn't a tracking pixel (a width/height attribute under 50). */
function firstImgSrc(html: string | undefined): string | undefined {
  for (const [tag] of (html ?? '').matchAll(IMG_TAG_PATTERN)) {
    const sizes = [...tag.matchAll(IMG_SIZE_ATTR_PATTERN)].map(([, n]) => Number(n));
    if (sizes.some((n) => n < MIN_IMG_SIZE_PX)) {
      continue;
    }
    const src = safeUrl(IMG_SRC_ATTR_PATTERN.exec(tag)?.[1]);
    if (src) {
      return src;
    }
  }
  return undefined;
}

/**
 * Feed-only image ladder (spec 067 D2): image enclosure → media:content
 * (largest width) → media:thumbnail → itunes:image → <img> in content:encoded
 * → <img> in content/summary. Only http(s) URLs are ever accepted — rejects
 * javascript:/data:/relative URIs from a hostile feed.
 */
function extractImageUrl(item: RawFeedItem): string | undefined {
  const { enclosureUrl, enclosureType } = item;
  const enclosureIsImage = enclosureType
    ? enclosureType.startsWith('image/')
    : IMAGE_EXTENSION_PATTERN.test(enclosureUrl ?? '');
  if (enclosureIsImage && safeUrl(enclosureUrl)) {
    return enclosureUrl;
  }

  const media = (item.mediaContent ?? [])
    .filter((m) => isImageMedia(m.medium, m.type) && safeUrl(m.url))
    .sort((a, b) => (b.width ?? 0) - (a.width ?? 0));
  if (media.length > 0) {
    return media[0].url;
  }

  return (
    item.mediaThumbnails?.map(safeUrl).find(Boolean) ??
    safeUrl(item.itunesImage) ??
    firstImgSrc(item.contentEncoded) ??
    firstImgSrc(item.content ?? item.summary)
  );
}

/**
 * The article page's `og:image`, else `twitter:image` (spec 067 D3):
 * entity-decoded, resolved against `baseUrl`, http(s) only.
 */
export function extractPreviewImage(html: string, baseUrl: string): string | undefined {
  const byKey = new Map<string, string>();
  for (const [tag] of html.matchAll(META_TAG_PATTERN)) {
    let key: string | undefined;
    let content: string | undefined;
    for (const [, attr, dq, sq] of tag.matchAll(META_ATTR_PATTERN)) {
      const value = dq ?? sq;
      if (attr.toLowerCase() === 'content') {
        content = value;
      } else {
        key = value.toLowerCase();
      }
    }
    if (key && content !== undefined && !byKey.has(key)) {
      byKey.set(key, content);
    }
  }

  const raw = byKey.get('og:image') ?? byKey.get('twitter:image');
  if (!raw) {
    return undefined;
  }
  try {
    return safeUrl(new URL(decodeEntities(raw).trim(), baseUrl).href);
  } catch {
    return undefined;
  }
}

// ponytail: a logo is only detectable when 2+ looked-up articles share it, so a
// source with a single looked-up article keeps its logo; lift with counting
// across refreshes or a per-host image hash.
/**
 * Nulls every page-lookup image URL shared by 2+ article links of one source
 * refresh — a site logo, not an article image (spec 067 D6, FR-005).
 */
export function dropSharedPreviewImages(
  results: Map<string, string | null>,
): Map<string, string | null> {
  const uses = new Map<string, number>();
  for (const url of results.values()) {
    if (url) {
      uses.set(url, (uses.get(url) ?? 0) + 1);
    }
  }
  return new Map(
    [...results].map(([link, url]) => [link, url && uses.get(url) === 1 ? url : null]),
  );
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
