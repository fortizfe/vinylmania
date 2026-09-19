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

export const LIBRARY_SORT_OPTIONS: readonly LibrarySortOption[] = [
  {
    sort: 'added',
    dir: 'desc',
    group: 'Date added',
    label: 'Newest first',
    announcement: 'Sorted by date added, newest first.',
  },
  {
    sort: 'added',
    dir: 'asc',
    group: 'Date added',
    label: 'Oldest first',
    announcement: 'Sorted by date added, oldest first.',
  },
  {
    sort: 'artist',
    dir: 'asc',
    group: 'Artist',
    label: 'Artist (A → Z)',
    announcement: 'Sorted by artist, A to Z.',
  },
  {
    sort: 'artist',
    dir: 'desc',
    group: 'Artist',
    label: 'Artist (Z → A)',
    announcement: 'Sorted by artist, Z to A.',
  },
  {
    sort: 'album',
    dir: 'asc',
    group: 'Album',
    label: 'Album (A → Z)',
    announcement: 'Sorted by album, A to Z.',
  },
  {
    sort: 'album',
    dir: 'desc',
    group: 'Album',
    label: 'Album (Z → A)',
    announcement: 'Sorted by album, Z to A.',
  },
];
