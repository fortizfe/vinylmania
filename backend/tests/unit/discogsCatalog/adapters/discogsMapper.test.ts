import {
  mapArtist,
  mapMasterRelease,
  mapMasterReleaseVersion,
  mapRelease,
  mapSearchResult,
} from '../../../../src/adapters/discogsCatalog/discogsMapper';

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

  it('maps a master search result, splitting artist from title like a release (feature 026, US1)', () => {
    const mapped = mapSearchResult({
      id: 1660109,
      type: 'master',
      title: 'The Persuader - Stockholm',
      year: '1999',
      format: ['Vinyl'],
      thumb: '',
      cover_image: 'https://example.com/cover.jpg',
      resource_url: 'https://api.discogs.com/masters/1660109',
    });

    expect(mapped).toEqual({
      discogsId: 1660109,
      resultType: 'master',
      title: 'Stockholm',
      artist: 'The Persuader',
      year: 1999,
      formats: ['Vinyl'],
      thumbnailUrl: 'https://example.com/cover.jpg',
    });
  });

  it('omits year/formats/thumbnail on a master result when Discogs provides none (feature 026, US1)', () => {
    const mapped = mapSearchResult({
      id: 1660109,
      type: 'master',
      title: 'The Persuader - Stockholm',
      thumb: '',
      cover_image: '',
      resource_url: 'https://api.discogs.com/masters/1660109',
    });

    expect(mapped).toEqual({
      discogsId: 1660109,
      resultType: 'master',
      title: 'Stockholm',
      artist: 'The Persuader',
    });
  });

  describe('country/labels (feature 052, US3)', () => {
    it('includes country and labels on a release result when Discogs provides them', () => {
      const mapped = mapSearchResult({
        id: 1,
        type: 'release',
        title: 'The Persuader - Stockholm',
        year: '1999',
        format: ['Vinyl'],
        country: 'Sweden',
        label: ['Svek', 'Other Label'],
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
        formats: ['Vinyl'],
        thumbnailUrl: 'https://example.com/cover.jpg',
        country: 'Sweden',
        labels: ['Svek', 'Other Label'],
      });
    });

    it('omits country and labels entirely (not null/[]) when Discogs provides neither', () => {
      const mapped = mapSearchResult({
        id: 1,
        type: 'release',
        title: 'The Persuader - Stockholm',
        thumb: '',
        cover_image: '',
        resource_url: 'https://api.discogs.com/releases/1',
      });

      expect(mapped).toEqual({
        discogsId: 1,
        resultType: 'release',
        title: 'Stockholm',
        artist: 'The Persuader',
      });
      expect(mapped).not.toHaveProperty('country');
      expect(mapped).not.toHaveProperty('labels');
    });

    it('includes country and labels on a master result too when Discogs provides them, matching the existing year/formats treatment', () => {
      const mapped = mapSearchResult({
        id: 1660109,
        type: 'master',
        title: 'The Persuader - Stockholm',
        country: 'Sweden',
        label: ['Svek'],
        thumb: '',
        cover_image: '',
        resource_url: 'https://api.discogs.com/masters/1660109',
      });

      expect(mapped).toEqual({
        discogsId: 1660109,
        resultType: 'master',
        title: 'Stockholm',
        artist: 'The Persuader',
        country: 'Sweden',
        labels: ['Svek'],
      });
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
    images: [
      { type: 'primary', uri: 'https://example.com/cover.jpg', width: 600, height: 600 },
    ],
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
      images: [
        {
          url: 'https://example.com/cover.jpg',
          imageType: 'primary',
          width: 600,
          height: 600,
        },
      ],
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
      {
        discogsArtistId: 1,
        name: 'The Persuader',
        nameVariation: 'Persuader',
        joinPhrase: '&',
      },
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
    const {
      released: _released,
      notes: _notes,
      identifiers: _identifiers,
      community: _community,
      ...rawWithoutNewFields
    } = baseRawRelease;

    const mapped = mapRelease(rawWithoutNewFields);

    expect(mapped.releaseDate).toBeUndefined();
    expect(mapped.notes).toBeUndefined();
    expect(mapped.community).toBeUndefined();
    expect(mapped.identifiers).toEqual([]);
  });
});

describe('mapMasterRelease (feature 026, US3)', () => {
  const baseRawMaster = {
    id: 1660109,
    title: 'Hybrid Theory',
    year: 2000,
    artists: [{ id: 1, name: 'Linkin Park', anv: '', join: '', role: '' }],
    genres: ['Rock'],
    styles: ['Nu Metal'],
    images: [
      { type: 'primary', uri: 'https://example.com/cover.jpg', width: 600, height: 600 },
    ],
    tracklist: [{ position: '1', type_: 'track', title: 'Papercut', duration: '3:05' }],
    main_release: 98765,
    uri: 'https://www.discogs.com/master/1660109-Linkin-Park-Hybrid-Theory',
  };

  it('maps a full master release', () => {
    expect(mapMasterRelease(baseRawMaster)).toEqual({
      discogsId: 1660109,
      title: 'Hybrid Theory',
      year: 2000,
      artists: [{ discogsArtistId: 1, name: 'Linkin Park' }],
      genres: ['Rock'],
      styles: ['Nu Metal'],
      images: [
        {
          url: 'https://example.com/cover.jpg',
          imageType: 'primary',
          width: 600,
          height: 600,
        },
      ],
      tracklist: [{ position: '1', title: 'Papercut', duration: '3:05' }],
      mainReleaseId: 98765,
      discogsUrl: 'https://www.discogs.com/master/1660109-Linkin-Park-Hybrid-Theory',
    });
  });

  it('tolerates a missing year, genres, styles, images, and tracklist', () => {
    const {
      year: _year,
      genres: _genres,
      styles: _styles,
      images: _images,
      tracklist: _tracklist,
      ...rawWithoutOptionals
    } = baseRawMaster;

    const mapped = mapMasterRelease(rawWithoutOptionals);

    expect(mapped.year).toBeUndefined();
    expect(mapped.genres).toEqual([]);
    expect(mapped.styles).toEqual([]);
    expect(mapped.images).toEqual([]);
    expect(mapped.tracklist).toEqual([]);
  });
});

describe('mapMasterReleaseVersion (feature 026, US3)', () => {
  it('maps a full version', () => {
    const mapped = mapMasterReleaseVersion({
      id: 98765,
      title: 'Hybrid Theory',
      format: 'Vinyl, LP, Album',
      label: 'Warner Bros. Records',
      catno: '9362-47755-1',
      released: '2000',
      country: 'US',
      thumb: 'https://example.com/thumb.jpg',
    });

    expect(mapped).toEqual({
      discogsId: 98765,
      title: 'Hybrid Theory',
      format: 'Vinyl, LP, Album',
      label: 'Warner Bros. Records',
      year: 2000,
      country: 'US',
      thumbnailUrl: 'https://example.com/thumb.jpg',
    });
  });

  it('omits format, label, year, country, and thumbnailUrl when Discogs has none of them', () => {
    const mapped = mapMasterReleaseVersion({ id: 1, title: 'Untitled Version' });

    expect(mapped).toEqual({
      discogsId: 1,
      title: 'Untitled Version',
    });
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
      aliases: [
        {
          id: 239,
          name: 'Jesper Dahlbäck',
          resource_url: 'https://api.discogs.com/artists/239',
        },
      ],
      images: [
        {
          type: 'primary',
          uri: 'https://example.com/artist.jpg',
          width: 600,
          height: 771,
        },
      ],
      uri: 'https://www.discogs.com/artist/1-The-Persuader',
    });

    expect(mapped).toEqual({
      discogsId: 1,
      name: 'The Persuader',
      realName: 'Jesper Dahlbäck',
      profile: 'Electronic artist working out of Stockholm, active since 1994.',
      nameVariations: ['Persuader', 'The Presuader'],
      aliases: [{ discogsArtistId: 239, name: 'Jesper Dahlbäck' }],
      images: [
        {
          url: 'https://example.com/artist.jpg',
          imageType: 'primary',
          width: 600,
          height: 771,
        },
      ],
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
