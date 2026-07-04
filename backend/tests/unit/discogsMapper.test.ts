import { mapArtist, mapRelease, mapSearchResult } from '../../src/discogs/discogsMapper';

describe('mapSearchResult', () => {
  it('maps a full release search result', () => {
    const mapped = mapSearchResult({
      id: 1,
      type: 'release',
      title: 'The Persuader - Stockholm',
      year: '1999',
      format: ['Vinyl', '12"', '33 ⅓ RPM'],
      thumb: '',
      cover_image: 'https://example.com/cover.jpg',
      resource_url: 'https://api.discogs.com/releases/1',
    });

    expect(mapped).toEqual({
      discogsId: 1,
      resultType: 'release',
      title: 'Stockholm',
      artist: 'The Persuader',
      year: 1999,
      formats: ['Vinyl', '12"', '33 ⅓ RPM'],
      thumbnailUrl: 'https://example.com/cover.jpg',
    });
  });

  it('omits year/formats/thumbnail when Discogs has no thumb, cover_image, or year', () => {
    const mapped = mapSearchResult({
      id: 1,
      type: 'artist',
      title: 'The Persuader',
      thumb: '',
      cover_image: '',
      resource_url: 'https://api.discogs.com/artists/1',
    });

    expect(mapped).toEqual({
      discogsId: 1,
      resultType: 'artist',
      title: 'The Persuader',
    });
  });
});

describe('mapRelease', () => {
  const baseRawRelease = {
    id: 1,
    title: 'Stockholm',
    year: 1999,
    country: 'Sweden',
    released: '1999-05-01',
    notes: 'Recorded at Stockholm Sound Studio.',
    artists: [{ id: 1, name: 'The Persuader', anv: '', join: '', role: '' }],
    labels: [{ id: 5, name: 'Svek', catno: 'SK032' }],
    formats: [{ name: 'Vinyl', qty: '2', descriptions: ['12"', '33 ⅓ RPM'] }],
    genres: ['Electronic'],
    styles: ['Deep House'],
    identifiers: [
      { type: 'Barcode', value: '7 39051 23421 6' },
      { type: 'Matrix / Runout', value: 'SK032-A', description: 'Side A Runout' },
    ],
    community: { have: 214, want: 58, rating: { average: 4.3, count: 37 } },
    tracklist: [{ position: 'A', type_: 'track', title: 'Östermalm', duration: '4:45' }],
    images: [{ type: 'primary', uri: 'https://example.com/cover.jpg', width: 600, height: 600 }],
    master_id: 1660109,
    uri: 'https://www.discogs.com/release/1-The-Persuader-Stockholm',
  };

  it('maps a full single-artist release', () => {
    expect(mapRelease(baseRawRelease)).toEqual({
      discogsId: 1,
      title: 'Stockholm',
      year: 1999,
      country: 'Sweden',
      releaseDate: '1999-05-01',
      notes: 'Recorded at Stockholm Sound Studio.',
      artists: [{ discogsArtistId: 1, name: 'The Persuader' }],
      labels: [{ discogsLabelId: 5, name: 'Svek', catalogNumber: 'SK032' }],
      formats: [{ name: 'Vinyl', quantity: 2, descriptions: ['12"', '33 ⅓ RPM'] }],
      genres: ['Electronic'],
      styles: ['Deep House'],
      identifiers: [
        { type: 'Barcode', value: '7 39051 23421 6' },
        { type: 'Matrix / Runout', value: 'SK032-A', description: 'Side A Runout' },
      ],
      community: { have: 214, want: 58, rating: { average: 4.3, count: 37 } },
      tracklist: [{ position: 'A', title: 'Östermalm', duration: '4:45' }],
      images: [{ url: 'https://example.com/cover.jpg', imageType: 'primary', width: 600, height: 600 }],
      masterId: 1660109,
      discogsUrl: 'https://www.discogs.com/release/1-The-Persuader-Stockholm',
    });
  });

  it('supports multiple artist credits with name variation and join phrase (collaboration)', () => {
    const raw = {
      ...baseRawRelease,
      artists: [
        { id: 1, name: 'The Persuader', anv: 'Persuader', join: '&', role: '' },
        { id: 239, name: 'Jesper Dahlbäck', anv: '', join: '', role: '' },
      ],
    };

    const mapped = mapRelease(raw);

    expect(mapped.artists).toEqual([
      { discogsArtistId: 1, name: 'The Persuader', nameVariation: 'Persuader', joinPhrase: '&' },
      { discogsArtistId: 239, name: 'Jesper Dahlbäck' },
    ]);
  });

  it('tolerates a missing tracklist, images, and master_id', () => {
    const { master_id: _masterId, ...rawWithoutMaster } = baseRawRelease;
    const raw = { ...rawWithoutMaster, tracklist: [], images: [] };

    const mapped = mapRelease(raw);

    expect(mapped.tracklist).toEqual([]);
    expect(mapped.images).toEqual([]);
    expect(mapped.masterId).toBeUndefined();
  });

  it('omits releaseDate, notes, and community, and defaults identifiers to [], when Discogs has none of them', () => {
    const { released: _released, notes: _notes, identifiers: _identifiers, community: _community, ...rawWithoutNewFields } = baseRawRelease;

    const mapped = mapRelease(rawWithoutNewFields);

    expect(mapped.releaseDate).toBeUndefined();
    expect(mapped.notes).toBeUndefined();
    expect(mapped.community).toBeUndefined();
    expect(mapped.identifiers).toEqual([]);
  });
});

describe('mapArtist', () => {
  it('maps a full artist with aliases', () => {
    const mapped = mapArtist({
      id: 1,
      name: 'The Persuader',
      realname: 'Jesper Dahlbäck',
      profile: 'Electronic artist working out of Stockholm, active since 1994.',
      namevariations: ['Persuader', 'The Presuader'],
      aliases: [{ id: 239, name: 'Jesper Dahlbäck', resource_url: 'https://api.discogs.com/artists/239' }],
      images: [{ type: 'primary', uri: 'https://example.com/artist.jpg', width: 600, height: 771 }],
      uri: 'https://www.discogs.com/artist/1-The-Persuader',
    });

    expect(mapped).toEqual({
      discogsId: 1,
      name: 'The Persuader',
      realName: 'Jesper Dahlbäck',
      profile: 'Electronic artist working out of Stockholm, active since 1994.',
      nameVariations: ['Persuader', 'The Presuader'],
      aliases: [{ discogsArtistId: 239, name: 'Jesper Dahlbäck' }],
      images: [{ url: 'https://example.com/artist.jpg', imageType: 'primary', width: 600, height: 771 }],
      discogsUrl: 'https://www.discogs.com/artist/1-The-Persuader',
    });
  });

  it('tolerates a missing realname, profile, images, and aliases', () => {
    const mapped = mapArtist({
      id: 42,
      name: 'Some Group',
      uri: 'https://www.discogs.com/artist/42-Some-Group',
    });

    expect(mapped).toEqual({
      discogsId: 42,
      name: 'Some Group',
      nameVariations: [],
      aliases: [],
      images: [],
      discogsUrl: 'https://www.discogs.com/artist/42-Some-Group',
    });
  });
});
