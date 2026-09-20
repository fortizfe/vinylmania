/**
 * The six library sort options (feature 068, contracts/library-ui.md §2,
 * research D14), in display order. `label` uses "→" visually only;
 * `announcement` spells "A to Z" so screen readers don't read "right arrow".
 */

export type LibrarySortCriterion = 'added' | 'artist' | 'album';
export type LibrarySortDirection = 'asc' | 'desc';

export interface LibrarySortValue {
  sort: LibrarySortCriterion;
  dir: LibrarySortDirection;
}

export interface LibrarySortOption extends LibrarySortValue {
  group: 'Date added' | 'Artist' | 'Album';
  label: string;
  announcement: string;
}

export const DEFAULT_LIBRARY_SORT: LibrarySortValue = { sort: 'added', dir: 'desc' };

/**
 * `announcement` is derived, never hand-written: the six strings are
 * mechanically `group` + `label`, so deriving them keeps them in sync with the
 * labels they mirror. A parenthesised label carries the detail ("Artist (A →
 * Z)" → "A to Z"); the rest is the label itself ("Newest first").
 */
function announce(group: LibrarySortOption['group'], label: string): string {
  const detail = label.match(/\((.*)\)/)?.[1]?.replace('→', 'to') ?? label.toLowerCase();
  return `Sorted by ${group.toLowerCase()}, ${detail}.`;
}

const SORT_OPTIONS: ReadonlyArray<Omit<LibrarySortOption, 'announcement'>> = [
  { sort: 'added', dir: 'desc', group: 'Date added', label: 'Newest first' },
  { sort: 'added', dir: 'asc', group: 'Date added', label: 'Oldest first' },
  { sort: 'artist', dir: 'asc', group: 'Artist', label: 'Artist (A → Z)' },
  { sort: 'artist', dir: 'desc', group: 'Artist', label: 'Artist (Z → A)' },
  { sort: 'album', dir: 'asc', group: 'Album', label: 'Album (A → Z)' },
  { sort: 'album', dir: 'desc', group: 'Album', label: 'Album (Z → A)' },
];

export const LIBRARY_SORT_OPTIONS: readonly LibrarySortOption[] = SORT_OPTIONS.map(
  (option) => ({ ...option, announcement: announce(option.group, option.label) }),
);
