/**
 * Pure matching logic for streaming-link resolution.
 *
 * Domain layer — this module imports nothing outside `domain/streaming/` and
 * has no infrastructure/SDK dependency. It decides whether a catalog result
 * from a streaming provider reliably corresponds to the record being resolved
 * (research.md §3).
 */

import type { StreamingLinkQuery } from './types';

/**
 * The subset of a streaming provider's album result this domain reasons about.
 * Providers return far more; only these fields drive a match decision.
 */
export interface StreamingCandidate {
  artistName?: string;
  collectionName?: string;
  collectionViewUrl?: string;
  collectionType?: string;
  wrapperType?: string;
}

/** Minimum Jaccard token overlap for a title to correspond by overlap alone. */
const MIN_TITLE_TOKEN_OVERLAP = 0.6;

// Trailing "edition/remaster" qualifiers that must not defeat an otherwise
// exact match ("Master of Puppets" vs "Master of Puppets (Remastered)").
const QUALIFIER_KEYWORDS = [
  'remaster',
  'remastered',
  'reissue',
  'deluxe',
  'deluxe edition',
  'super deluxe',
  'expanded',
  'expanded edition',
  'anniversary edition',
  'special edition',
  'bonus track version',
  'mono',
  'stereo',
  'mono version',
  'stereo version',
].join('|');

const TRAILING_BRACKET_QUALIFIER = new RegExp(
  `\\s*[([][^()\\[\\]]*(?:${QUALIFIER_KEYWORDS})[^()\\[\\]]*[)\\]]\\s*$`,
  'i',
);

const TRAILING_DASH_QUALIFIER = new RegExp(
  `\\s*[-–—]\\s*(?:\\d{4}\\s+)?(?:${QUALIFIER_KEYWORDS})\\b.*$`,
  'i',
);

/**
 * Normalises a title or artist name for comparison:
 * lowercase → strip diacritics (NFD + drop combining marks) → drop a trailing
 * parenthetical/bracketed or dash "remaster/edition" qualifier → remove
 * punctuation → collapse whitespace.
 */
export function normalize(input: string | null | undefined): string {
  if (!input) {
    return '';
  }

  let value = String(input)
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();

  value = value.replace(TRAILING_BRACKET_QUALIFIER, '');
  value = value.replace(TRAILING_DASH_QUALIFIER, '');

  return value
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokens(value: string): string[] {
  return value.split(' ').filter((token) => token.length > 0);
}

function jaccard(a: string[], b: string[]): number {
  if (a.length === 0 && b.length === 0) {
    return 1;
  }
  const setA = new Set(a);
  const setB = new Set(b);
  let intersection = 0;
  for (const token of setA) {
    if (setB.has(token)) {
      intersection += 1;
    }
  }
  const union = new Set([...a, ...b]).size;
  return union === 0 ? 0 : intersection / union;
}

function isAlbumResult(candidate: StreamingCandidate): boolean {
  return candidate.collectionType === 'Album' || candidate.wrapperType === 'collection';
}

function isVariousArtists(value: string): boolean {
  return value === 'various' || value.includes('various');
}

function textContains(a: string, b: string): boolean {
  return a === b || a.includes(b) || b.includes(a);
}

/** Artist correspondence: equal | contains | (query is "various" & candidate is a compilation). */
function artistCorresponds(queryArtist: string, candidate: StreamingCandidate): boolean {
  const query = normalize(queryArtist);
  const candidateArtist = normalize(candidate.artistName);

  if (isVariousArtists(query)) {
    return isVariousArtists(candidateArtist);
  }
  if (!query || !candidateArtist) {
    return false;
  }
  return textContains(query, candidateArtist);
}

/** Title correspondence: equal | contains | >= 0.6 Jaccard token overlap. */
function titleCorresponds(queryTitle: string, candidate: StreamingCandidate): boolean {
  const query = normalize(queryTitle);
  const candidateTitle = normalize(candidate.collectionName);

  if (!query || !candidateTitle) {
    return false;
  }
  if (textContains(query, candidateTitle)) {
    return true;
  }
  return jaccard(tokens(query), tokens(candidateTitle)) >= MIN_TITLE_TOKEN_OVERLAP;
}

/**
 * A barcode/UPC is an exact identifier, so an album result is accepted
 * WITHOUT a text check — with one guard: when the query artist is known and
 * the candidate's artist is wholly unrelated (no shared token, no
 * containment), the barcode is treated as reused/rebadged and rejected
 * (research.md §3, spec edge case).
 */
export function isReliableUpcMatch(
  candidate: StreamingCandidate,
  query: StreamingLinkQuery,
): boolean {
  if (!isAlbumResult(candidate) || !candidate.collectionViewUrl) {
    return false;
  }

  const queryArtist = normalize(query.artist);
  if (!queryArtist || isVariousArtists(queryArtist)) {
    return true;
  }

  const candidateArtist = normalize(candidate.artistName);
  if (!candidateArtist) {
    return true;
  }
  if (textContains(queryArtist, candidateArtist)) {
    return true;
  }

  const queryTokens = new Set(tokens(queryArtist));
  return tokens(candidateArtist).some((token) => queryTokens.has(token));
}

/**
 * Text-search fallback is the risky path, so it is strict: a candidate is
 * accepted only when BOTH the artist and the title correspond. Returns the
 * first (highest-ranked) passing candidate, or `null` — an ambiguous or
 * partial match is never a match.
 */
export function pickReliableSearchMatch(
  candidates: readonly StreamingCandidate[],
  query: StreamingLinkQuery,
): StreamingCandidate | null {
  for (const candidate of candidates ?? []) {
    if (!isAlbumResult(candidate) || !candidate.collectionViewUrl) {
      continue;
    }
    if (
      artistCorresponds(query.artist, candidate) &&
      titleCorresponds(query.title, candidate)
    ) {
      return candidate;
    }
  }
  return null;
}
