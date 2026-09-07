import {
  isReliableUpcMatch,
  normalize,
  pickReliableSearchMatch,
  type StreamingCandidate,
} from '../../../src/domain/streaming/matching';
import type { StreamingLinkQuery } from '../../../src/domain/streaming/types';

function query(overrides: Partial<StreamingLinkQuery> = {}): StreamingLinkQuery {
  return {
    barcodes: [],
    artist: 'Metallica',
    title: 'Master of Puppets',
    storefront: 'ES',
    ...overrides,
  };
}

function album(overrides: Partial<StreamingCandidate> = {}): StreamingCandidate {
  return {
    wrapperType: 'collection',
    collectionType: 'Album',
    artistName: 'Metallica',
    collectionName: 'Master of Puppets',
    collectionViewUrl: 'https://music.apple.com/es/album/master-of-puppets/1440899482',
    ...overrides,
  };
}

describe('normalize()', () => {
  it('lowercases', () => {
    expect(normalize('ABBA')).toBe('abba');
  });

  it('strips diacritics via NFD', () => {
    expect(normalize('Björk')).toBe('bjork');
    expect(normalize('Motörhead')).toBe('motorhead');
    expect(normalize('Sigur Rós')).toBe('sigur ros');
  });

  it('removes punctuation', () => {
    expect(normalize('AC/DC')).toBe('ac dc');
    expect(normalize('Wish You Were Here!')).toBe('wish you were here');
    expect(normalize('Music (For the Masses)')).toContain('music');
  });

  it('collapses whitespace', () => {
    expect(normalize('Pink   Floyd')).toBe('pink floyd');
    expect(normalize('  Kind of Blue  ')).toBe('kind of blue');
  });

  it('drops a trailing "(Remastered)" qualifier', () => {
    expect(normalize('Master of Puppets (Remastered)')).toBe('master of puppets');
  });

  it('drops a trailing "[2011 Remaster]" qualifier', () => {
    expect(normalize('Nevermind [2011 Remaster]')).toBe('nevermind');
  });

  it('drops a trailing "- 2009 Remaster" qualifier', () => {
    expect(normalize('Abbey Road - 2009 Remaster')).toBe('abbey road');
  });

  it('keeps the core title when a qualifier is present', () => {
    expect(normalize('The Wall (Deluxe Edition)')).toBe('the wall');
  });

  it('returns empty string for nullish input', () => {
    expect(normalize(undefined)).toBe('');
    expect(normalize(null)).toBe('');
    expect(normalize('')).toBe('');
  });
});

describe('isReliableUpcMatch()', () => {
  it('accepts an album result without a text check when the artist corresponds', () => {
    expect(isReliableUpcMatch(album(), query())).toBe(true);
  });

  it('accepts an album result even when the title differs (the UPC is authoritative)', () => {
    expect(
      isReliableUpcMatch(
        album({ collectionName: 'Completely Different Title' }),
        query(),
      ),
    ).toBe(true);
  });

  it('accepts when the query artist is unknown (empty)', () => {
    expect(
      isReliableUpcMatch(album({ artistName: 'Whoever' }), query({ artist: '' })),
    ).toBe(true);
  });

  it('rejects when the candidate artist is wholly unrelated to a known query artist', () => {
    expect(
      isReliableUpcMatch(
        album({ artistName: 'Taylor Swift' }),
        query({ artist: 'Metallica' }),
      ),
    ).toBe(false);
  });

  it('rejects a non-album result', () => {
    expect(
      isReliableUpcMatch(
        album({ collectionType: 'Single', wrapperType: 'track' }),
        query(),
      ),
    ).toBe(false);
  });

  it('rejects a result with no collectionViewUrl', () => {
    expect(isReliableUpcMatch(album({ collectionViewUrl: undefined }), query())).toBe(
      false,
    );
  });
});

describe('pickReliableSearchMatch()', () => {
  it('returns a candidate when BOTH artist and title correspond exactly', () => {
    const match = pickReliableSearchMatch([album()], query());
    expect(match).not.toBeNull();
    expect(match?.collectionViewUrl).toBe(album().collectionViewUrl);
  });

  it('accepts an artist "contains" correspondence (feat. credit)', () => {
    const match = pickReliableSearchMatch(
      [album({ artistName: 'Metallica feat. Ghost' })],
      query(),
    );
    expect(match).not.toBeNull();
  });

  it('accepts a title correspondence via >= 0.6 Jaccard token overlap', () => {
    const match = pickReliableSearchMatch(
      [album({ collectionName: 'Greatest Hits Vol 1' })],
      query({ title: 'Greatest Hits Volume 1' }),
    );
    expect(match).not.toBeNull();
  });

  it('accepts a "Various" query artist against a compilation candidate', () => {
    const match = pickReliableSearchMatch(
      [
        album({
          artistName: 'Various Artists',
          collectionName: 'Café del Mar, Vol. 1',
        }),
      ],
      query({ artist: 'Various', title: 'Cafe del Mar Vol 1' }),
    );
    expect(match).not.toBeNull();
  });

  it('returns null when only the title corresponds (artist unrelated)', () => {
    expect(
      pickReliableSearchMatch(
        [album({ artistName: 'A Completely Different Band' })],
        query(),
      ),
    ).toBeNull();
  });

  it('returns null when only the artist corresponds (title unrelated)', () => {
    expect(
      pickReliableSearchMatch([album({ collectionName: 'Ride the Lightning' })], query()),
    ).toBeNull();
  });

  it('returns null for an ambiguous / partial match (neither field corresponds)', () => {
    expect(
      pickReliableSearchMatch(
        [album({ artistName: 'Miles Davis', collectionName: 'Bitches Brew' })],
        query(),
      ),
    ).toBeNull();
  });

  it('returns null for an empty candidate list', () => {
    expect(pickReliableSearchMatch([], query())).toBeNull();
  });

  it('picks the first passing candidate in list order', () => {
    const first = album({ collectionViewUrl: 'https://music.apple.com/es/album/a/1' });
    const second = album({ collectionViewUrl: 'https://music.apple.com/es/album/b/2' });
    expect(pickReliableSearchMatch([first, second], query())?.collectionViewUrl).toBe(
      'https://music.apple.com/es/album/a/1',
    );
  });
});
