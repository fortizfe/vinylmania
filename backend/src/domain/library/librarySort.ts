import type { LibraryEntry, LibrarySort } from './types';

// ponytail: English collation for every user, which satisfies FR-003 (case and
// diacritics fold: "Motörhead" = "Motorhead"); ceiling: alphabets whose letters
// are distinct at the base level (Swedish å/ä/ö sort after z instead of with
// a/o, Spanish ñ collates as n); upgrade: take the locale from Accept-Language
// in libraryRoutes and pass it down to build the collator per request.
const collator = new Intl.Collator('en', { sensitivity: 'base', numeric: true });
const LEADING_ARTICLE = /^(the|a|an|el|la|los|las|die|les)\s+(?=\S)/i;

/** Trimmed, article-stripped sort key; `undefined` when absent or blank. */
function sortKey(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed.replace(LEADING_ARTICLE, '') : undefined;
}

/** Present keys first (collated), missing keys last — regardless of direction. */
function compareKeys(a: string | undefined, b: string | undefined): number {
  if (a === undefined) return b === undefined ? 0 : 1;
  if (b === undefined) return -1;
  return collator.compare(a, b);
}

function compareStrings(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

type Decorated = { entry: LibraryEntry; artist?: string; album?: string };

/**
 * The library order (feature 068, data-model.md §3). Only the primary key
 * follows `direction`; secondary keys are fixed and every chain ends with
 * `id asc`, so the result is a pure function of `(entries, sort)`.
 */
export function sortLibraryEntries(
  entries: LibraryEntry[],
  sort: LibrarySort,
): LibraryEntry[] {
  const sign = sort.direction === 'asc' ? 1 : -1;
  const decorated: Decorated[] = entries.map((entry) => ({
    entry,
    artist: sortKey(entry.primaryArtist),
    album: sortKey(entry.title),
  }));

  const byAddedDescThenId = (a: Decorated, b: Decorated) =>
    compareStrings(b.entry.addedAt, a.entry.addedAt) ||
    compareStrings(a.entry.id, b.entry.id);

  const compare = (a: Decorated, b: Decorated): number => {
    if (sort.criterion === 'added') {
      return (
        sign * compareStrings(a.entry.addedAt, b.entry.addedAt) ||
        compareStrings(a.entry.id, b.entry.id)
      );
    }
    const [primary, secondary] =
      sort.criterion === 'artist'
        ? (['artist', 'album'] as const)
        : (['album', 'artist'] as const);
    const pa = a[primary];
    const pb = b[primary];
    if (pa === undefined || pb === undefined) {
      return compareKeys(pa, pb) || byAddedDescThenId(a, b);
    }
    return (
      sign * collator.compare(pa, pb) ||
      compareKeys(a[secondary], b[secondary]) ||
      byAddedDescThenId(a, b)
    );
  };

  return decorated.sort(compare).map((d) => d.entry);
}
