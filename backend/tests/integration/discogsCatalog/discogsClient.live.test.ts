import { getArtist, getRelease, searchCatalog } from '../../../src/adapters/discogsCatalog/discogsCatalogAdapter';
import { DiscogsNotFoundError } from '../../../src/discogs/discogsErrors';

// These tests call the real, public api.discogs.com for permanent, stable,
// well-known IDs (see research.md §8) — deliberately small in number to
// respect the real rate limit. Requires DISCOGS_TOKEN in the environment.
// CI has no such token (and no business making outbound calls to a
// third-party API in a shared runner), so this whole suite is opt-in: it
// only runs when a developer has DISCOGS_TOKEN configured locally.
const describeLive = process.env.DISCOGS_TOKEN ? describe : describe.skip;

describeLive('Discogs client live integration: searchCatalog', () => {
  it('finds the real "Stockholm" release (Discogs ID 1) when searching by title', async () => {
    const result = await searchCatalog({ type: 'vinylmania' }, 'Persuader Stockholm', { resultType: 'release' });

    expect(result.results.some((r) => r.discogsId === 1)).toBe(true);
  });

  it('finds the real "The Persuader" artist (Discogs ID 1) when searching by name', async () => {
    const result = await searchCatalog({ type: 'vinylmania' }, 'The Persuader', { resultType: 'artist' });

    expect(result.results.some((r) => r.discogsId === 1)).toBe(true);
  });
});

describeLive('Discogs client live integration: getRelease', () => {
  it('maps the real release ID 1 ("Stockholm")', async () => {
    const release = await getRelease({ type: 'vinylmania' }, 1);

    expect(release.title).toBe('Stockholm');
    expect(release.artists.some((a) => a.name === 'The Persuader')).toBe(true);
    expect(release.tracklist.length).toBeGreaterThan(0);
  });

  it('rejects with DiscogsNotFoundError for an ID that does not exist', async () => {
    await expect(getRelease({ type: 'vinylmania' }, 999999999)).rejects.toBeInstanceOf(DiscogsNotFoundError);
  });
});

describeLive('Discogs client live integration: getArtist', () => {
  it('maps the real artist ID 1 ("The Persuader")', async () => {
    const artist = await getArtist({ type: 'vinylmania' }, 1);

    expect(artist.name).toBe('The Persuader');
    expect(artist.realName).toBe('Jesper Dahlbäck');
    expect(artist.aliases.length).toBeGreaterThan(0);
  });

  it('rejects with DiscogsNotFoundError for an ID that does not exist', async () => {
    await expect(getArtist({ type: 'vinylmania' }, 999999999)).rejects.toBeInstanceOf(DiscogsNotFoundError);
  });
});
