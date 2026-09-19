import type { Article } from '../services/feedsApi';

/** Initials of the first two words of a source name, e.g. "Metal Underground" → "MU" (D9). */
export function sourceMonogram(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  return words.length
    ? words
        .slice(0, 2)
        .map((w) => w[0].toUpperCase())
        .join('')
    : '?';
}

export interface PortadaSlots {
  lead: Article | undefined;
  secondary: Article[];
  latest: Article[];
}

const SECONDARY_COUNT = 4;

/**
 * Portada slots (D8, FR-009): lead = newest article with an image; up to 4
 * secondaries = next newest with an image, one per source (lead's included)
 * while other sources have candidates, then relaxed; everything else → latest.
 * All three lists are newest first.
 */
export function assignPortadaSlots(articles: Article[]): PortadaSlots {
  const sorted = [...articles].sort(
    (a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt),
  );
  const [lead, ...candidates] = sorted.filter((a) => a.imageUrl);
  const picked = new Set<Article>();
  const usedSources = new Set(lead ? [lead.sourceId] : []);

  for (const a of candidates) {
    if (picked.size < SECONDARY_COUNT && !usedSources.has(a.sourceId)) {
      picked.add(a);
      usedSources.add(a.sourceId);
    }
  }
  for (const a of candidates) {
    if (picked.size < SECONDARY_COUNT) picked.add(a);
  }

  return {
    lead,
    secondary: candidates.filter((a) => picked.has(a)),
    latest: sorted.filter((a) => a !== lead && !picked.has(a)),
  };
}

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** Compact relative age (D10): "just now" / "25m ago" / "3h ago" / "2d ago" / "Sep 12". */
export function formatArticleAge(iso: string, now: Date): string {
  const date = new Date(iso);
  const diff = now.getTime() - date.getTime();
  if (diff < MINUTE) return 'just now';
  if (diff < HOUR) return `${Math.floor(diff / MINUTE)}m ago`;
  if (diff < DAY) return `${Math.floor(diff / HOUR)}h ago`;
  if (diff < 7 * DAY) return `${Math.floor(diff / DAY)}d ago`;
  return date.toLocaleDateString('en', { month: 'short', day: 'numeric' });
}

export type FeedArticleCardVariant = 'lead' | 'tile' | 'row';

// Per-variant card boxes (plan.md "Card variants"), shared by FeedArticleCard
// and FeedArticleCardSkeleton so loading and loaded cards take the same space.
export const feedCardLayout = {
  lead: 'flex flex-col gap-3',
  tile: 'flex flex-col gap-2',
  row: 'flex flex-row items-start gap-3 sm:gap-4',
} as const;

export const feedCardMedia = {
  lead: 'aspect-video w-full rounded-xl',
  tile: 'aspect-video w-full rounded-lg',
  row: 'size-18 shrink-0 rounded-lg sm:size-24',
} as const;
