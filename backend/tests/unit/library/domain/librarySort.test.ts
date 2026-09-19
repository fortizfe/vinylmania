import { sortLibraryEntries } from '../../../../src/domain/library/librarySort';
import type { LibraryEntry, LibrarySort } from '../../../../src/domain/library/types';

/**
 * Feature 068, T006 — the pure library ordering (data-model.md §3, FR-003,
 * FR-003a, FR-004, FR-005). Only the primary key follows `direction`;
 * secondary keys are fixed, and records without the key always come last.
 */

function entry(id: string, overrides: Partial<LibraryEntry> = {}): LibraryEntry {
  return {
    id,
    discogsReleaseId: 1,
    addedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

const ARTIST_ASC: LibrarySort = { criterion: 'artist', direction: 'asc' };
const ARTIST_DESC: LibrarySort = { criterion: 'artist', direction: 'desc' };
const ALBUM_ASC: LibrarySort = { criterion: 'album', direction: 'asc' };
const ALBUM_DESC: LibrarySort = { criterion: 'album', direction: 'desc' };
const ADDED_ASC: LibrarySort = { criterion: 'added', direction: 'asc' };
const ADDED_DESC: LibrarySort = { criterion: 'added', direction: 'desc' };

function ids(entries: LibraryEntry[], sort: LibrarySort): string[] {
  return sortLibraryEntries(entries, sort).map((e) => e.id);
}

describe('sortLibraryEntries: key normalisation (FR-003, FR-003a)', () => {
  it.each([
    ['Motörhead', 'motorhead'],
    ['Björk', 'Bjork'],
    ['ac/dc', 'AC/DC'],
  ])('treats "%s" and "%s" as the same artist (tie broken by album asc)', (a, b) => {
    const entries = [
      entry('first-by-name', { primaryArtist: a, title: 'Zulu' }),
      entry('second-by-name', { primaryArtist: b, title: 'Alpha' }),
    ];

    expect(ids(entries, ARTIST_ASC)).toEqual(['second-by-name', 'first-by-name']);
  });

  it('files names under the word after one leading article, and keeps "The" alone as "The"', () => {
    const entries = [
      entry('the', { primaryArtist: 'The' }),
      entry('tool', { primaryArtist: 'Tool' }),
      entry('perfect-circle', { primaryArtist: 'A Perfect Circle' }),
      entry('motorhead', { primaryArtist: 'Motörhead' }),
      entry('suaves', { primaryArtist: 'Los Suaves' }),
      entry('clash', { primaryArtist: 'The Clash' }),
      entry('bjork', { primaryArtist: 'Björk' }),
      entry('anthrax', { primaryArtist: 'Anthrax' }),
    ];

    expect(ids(entries, ARTIST_ASC)).toEqual([
      'anthrax', // "Anthrax" is not "An thrax"
      'bjork',
      'clash', // "The Clash" under C
      'motorhead',
      'perfect-circle', // "A Perfect Circle" under P
      'suaves', // "Los Suaves" under S
      'the', // "The" alone stays "The"
      'tool',
    ]);
  });

  it.each(['The', 'A', 'An', 'El', 'La', 'Los', 'Las', 'Die', 'Les'])(
    'strips the leading article "%s"',
    (article) => {
      const entries = [
        entry('with-article', { primaryArtist: `${article} Zeta` }),
        entry('mu', { primaryArtist: 'Mu' }),
      ];

      expect(ids(entries, ARTIST_ASC)).toEqual(['mu', 'with-article']);
    },
  );

  it('compares numbers naturally ("Vol. 2" before "Vol. 10")', () => {
    const entries = [
      entry('vol-10', { title: 'Vol. 10' }),
      entry('vol-1', { title: 'Vol. 1' }),
      entry('vol-2', { title: 'Vol. 2' }),
    ];

    expect(ids(entries, ALBUM_ASC)).toEqual(['vol-1', 'vol-2', 'vol-10']);
  });
});

describe('sortLibraryEntries: missing keys sort last (FR-004)', () => {
  const entries = [
    entry('missing-old', { addedAt: '2020-01-01T00:00:00.000Z' }),
    entry('blank-new', {
      primaryArtist: '   ',
      title: '   ',
      addedAt: '2026-05-01T00:00:00.000Z',
    }),
    entry('empty-mid-b', {
      primaryArtist: '',
      title: '',
      addedAt: '2023-01-01T00:00:00.000Z',
    }),
    entry('empty-mid-a', { addedAt: '2023-01-01T00:00:00.000Z' }),
    entry('present-z', { primaryArtist: 'Zappa', title: 'Zoot Allures' }),
    entry('present-a', { primaryArtist: 'Abba', title: 'Arrival' }),
  ];
  const missingNewestFirstThenId = [
    'blank-new',
    'empty-mid-a',
    'empty-mid-b',
    'missing-old',
  ];

  it.each([
    ['artist asc', ARTIST_ASC, ['present-a', 'present-z']],
    ['artist desc', ARTIST_DESC, ['present-z', 'present-a']],
    ['album asc', ALBUM_ASC, ['present-a', 'present-z']],
    ['album desc', ALBUM_DESC, ['present-z', 'present-a']],
  ])(
    '%s: present first, then missing/empty newest first, then by id',
    (_name, sort, present) => {
      expect(ids(entries, sort)).toEqual([...present, ...missingNewestFirstThenId]);
    },
  );
});

describe('sortLibraryEntries: tie-breaks (FR-005)', () => {
  it('artist ties → album asc (missing album last) → addedAt desc → id asc; only the artist follows dir', () => {
    const entries = [
      entry('slayer-no-album', { primaryArtist: 'Slayer' }),
      entry('slayer-reign-old', {
        primaryArtist: 'Slayer',
        title: 'Reign in Blood',
        addedAt: '2020-01-01T00:00:00.000Z',
      }),
      entry('slayer-reign-new-b', {
        primaryArtist: 'Slayer',
        title: 'Reign in Blood',
        addedAt: '2024-01-01T00:00:00.000Z',
      }),
      entry('slayer-reign-new-a', {
        primaryArtist: 'Slayer',
        title: 'Reign in Blood',
        addedAt: '2024-01-01T00:00:00.000Z',
      }),
      entry('slayer-hell', { primaryArtist: 'Slayer', title: 'Hell Awaits' }),
      entry('anthrax', { primaryArtist: 'Anthrax', title: 'Among the Living' }),
    ];
    const slayerGroup = [
      'slayer-hell',
      'slayer-reign-new-a',
      'slayer-reign-new-b',
      'slayer-reign-old',
      'slayer-no-album',
    ];

    expect(ids(entries, ARTIST_ASC)).toEqual(['anthrax', ...slayerGroup]);
    expect(ids(entries, ARTIST_DESC)).toEqual([...slayerGroup, 'anthrax']);
  });

  it('album ties → artist asc (missing artist last) → addedAt desc → id asc; only the album follows dir', () => {
    const entries = [
      entry('greatest-no-artist', { title: 'Greatest Hits' }),
      entry('greatest-queen-old', {
        primaryArtist: 'Queen',
        title: 'Greatest Hits',
        addedAt: '2020-01-01T00:00:00.000Z',
      }),
      entry('greatest-queen-new-b', {
        primaryArtist: 'Queen',
        title: 'Greatest Hits',
        addedAt: '2024-01-01T00:00:00.000Z',
      }),
      entry('greatest-queen-new-a', {
        primaryArtist: 'Queen',
        title: 'Greatest Hits',
        addedAt: '2024-01-01T00:00:00.000Z',
      }),
      entry('greatest-abba', { primaryArtist: 'ABBA', title: 'Greatest Hits' }),
      entry('arrival', { primaryArtist: 'ABBA', title: 'Arrival' }),
    ];
    const greatestGroup = [
      'greatest-abba',
      'greatest-queen-new-a',
      'greatest-queen-new-b',
      'greatest-queen-old',
      'greatest-no-artist',
    ];

    expect(ids(entries, ALBUM_ASC)).toEqual(['arrival', ...greatestGroup]);
    expect(ids(entries, ALBUM_DESC)).toEqual([...greatestGroup, 'arrival']);
  });

  it('added: addedAt follows dir, ties → id asc in both directions', () => {
    const entries = [
      entry('mid-b', { addedAt: '2023-01-01T00:00:00.000Z' }),
      entry('old', { addedAt: '2020-01-01T00:00:00.000Z' }),
      entry('new', { addedAt: '2025-01-01T00:00:00.000Z' }),
      entry('mid-a', { addedAt: '2023-01-01T00:00:00.000Z' }),
    ];

    expect(ids(entries, ADDED_DESC)).toEqual(['new', 'mid-a', 'mid-b', 'old']);
    expect(ids(entries, ADDED_ASC)).toEqual(['old', 'mid-a', 'mid-b', 'new']);
  });
});

describe('sortLibraryEntries: purity (FR-005, SC-007)', () => {
  const entries = [
    entry('e1', { primaryArtist: 'The Clash', title: 'London Calling' }),
    entry('e2', {
      primaryArtist: 'Björk',
      title: 'Homogenic',
      addedAt: '2024-01-01T00:00:00.000Z',
    }),
    entry('e3', {
      primaryArtist: 'Bjork',
      title: 'Homogenic',
      addedAt: '2024-01-01T00:00:00.000Z',
    }),
    entry('e4', {}),
    entry('e5', { primaryArtist: 'Motörhead', addedAt: '2022-01-01T00:00:00.000Z' }),
    entry('e6', { title: 'Vol. 10', addedAt: '2021-01-01T00:00:00.000Z' }),
  ];

  it.each([ARTIST_ASC, ARTIST_DESC, ALBUM_ASC, ALBUM_DESC, ADDED_ASC, ADDED_DESC])(
    'returns the same order for any permutation of the input (%o)',
    (sort) => {
      const expected = ids(entries, sort);
      const reversed = [...entries].reverse();
      const rotated = [...entries.slice(3), ...entries.slice(0, 3)];

      expect(ids(reversed, sort)).toEqual(expected);
      expect(ids(rotated, sort)).toEqual(expected);
    },
  );

  it('does not mutate the input array', () => {
    const input = [...entries];
    const before = input.map((e) => e.id);

    const output = sortLibraryEntries(input, ARTIST_ASC);

    expect(input.map((e) => e.id)).toEqual(before);
    expect(output).not.toBe(input);
  });
});
