/// The six library sort options, in display order (frontend
/// librarySortOptions.ts). `label` uses "→" visually only; `announcement`
/// spells "A to Z" so screen readers don't read "right arrow".
enum LibrarySort {
  newestFirst(
    'added',
    'desc',
    'Date added',
    'Newest first',
    'Sorted by date added, newest first.',
  ),
  oldestFirst(
    'added',
    'asc',
    'Date added',
    'Oldest first',
    'Sorted by date added, oldest first.',
  ),
  artistAsc(
    'artist',
    'asc',
    'Artist',
    'Artist (A → Z)',
    'Sorted by artist, A to Z.',
  ),
  artistDesc(
    'artist',
    'desc',
    'Artist',
    'Artist (Z → A)',
    'Sorted by artist, Z to A.',
  ),
  albumAsc(
    'album',
    'asc',
    'Album',
    'Album (A → Z)',
    'Sorted by album, A to Z.',
  ),
  albumDesc(
    'album',
    'desc',
    'Album',
    'Album (Z → A)',
    'Sorted by album, Z to A.',
  );

  const LibrarySort(
    this.field,
    this.dir,
    this.group,
    this.label,
    this.announcement,
  );

  /// `sort` query value.
  final String field;

  /// `dir` query value.
  final String dir;
  final String group;
  final String label;
  final String announcement;
}
