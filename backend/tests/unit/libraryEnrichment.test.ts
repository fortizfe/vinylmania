import { discogsScope } from '../helpers/nock';
import { MAX_ATTEMPTS } from '../../src/discogs/discogsRetry';
import { enrichEntries, enrichEntry } from '../../src/library/libraryEnrichment';
import * as libraryService from '../../src/library/libraryService';
import type { LibraryEntry } from '../../src/library/types';

const persistCatalogFieldsSpy = jest
  .spyOn(libraryService, 'persistCatalogFields')
  .mockResolvedValue(undefined);

const rawRelease = {
  id: 1,
  title: 'Stockholm',
  year: 1999,
  artists: [{ id: 1, name: 'The Persuader', anv: '', join: '', role: '' }],
  labels: [],
  formats: [{ name: 'Vinyl', descriptions: [] }],
  genres: ['Jazz'],
  styles: ['Fusion'],
  tracklist: [],
  images: [],
  uri: 'https://www.discogs.com/release/1-The-Persuader-Stockholm',
};

function entry(overrides: Partial<LibraryEntry>): LibraryEntry {
  return {
    id: 'e1',
    discogsReleaseId: 1,
    addedAt: '2026-07-03T00:00:00.000Z',
    ...overrides,
  };
}

beforeAll(() => {
  // Deterministic behavior regardless of a local Redis: several tests
  // below reuse release ID 1 across success and failure cases, which a
  // real cache-aside hit would otherwise short-circuit.
  delete process.env.REDIS_URL;
});

beforeEach(() => {
  persistCatalogFieldsSpy.mockClear();
});

describe('enrichEntry', () => {
  it('merges a successfully-fetched release with catalogStatus ok', async () => {
    discogsScope().get('/releases/1').reply(200, rawRelease);

    const result = await enrichEntry('u1', entry({}));

    expect(result.catalogStatus).toBe('ok');
    expect(result.release?.title).toBe('Stockholm');
  });

  it('sets catalogStatus unavailable and release null when Discogs 404s', async () => {
    discogsScope().get('/releases/1').reply(404, { message: 'not found' });

    const result = await enrichEntry('u1', entry({}));

    expect(result.catalogStatus).toBe('unavailable');
    expect(result.release).toBeNull();
  });

  it('sets catalogStatus unavailable when Discogs errors', async () => {
    discogsScope()
      .get('/releases/1')
      .times(MAX_ATTEMPTS)
      .reply(500, { message: 'server error' });

    const result = await enrichEntry('u1', entry({}));

    expect(result.catalogStatus).toBe('unavailable');
    expect(result.release).toBeNull();
  });

  describe('genre/style/format write-back (feature 038, US2, FR-018/FR-024)', () => {
    it('persists genre/style/format derived from a successfully-fetched release', async () => {
      discogsScope().get('/releases/1').reply(200, rawRelease);

      await enrichEntry('u1', entry({ id: 'e1' }));

      expect(persistCatalogFieldsSpy).toHaveBeenCalledWith('u1', 'e1', {
        genre: ['Jazz'],
        style: ['Fusion'],
        format: ['Vinyl'],
      });
    });

    it('derives format from each FormatDescriptor.name, not the raw descriptor objects', async () => {
      discogsScope()
        .get('/releases/1')
        .reply(200, {
          ...rawRelease,
          formats: [
            { name: 'Vinyl', descriptions: ['LP', 'Album'] },
            { name: 'CD', descriptions: [] },
          ],
        });

      await enrichEntry('u1', entry({ id: 'e1' }));

      expect(persistCatalogFieldsSpy).toHaveBeenCalledWith(
        'u1',
        'e1',
        expect.objectContaining({ format: ['Vinyl', 'CD'] }),
      );
    });

    it('does NOT write back genre/style/format when the lookup fails (FR-024, Clarifications Session 2026-07-12)', async () => {
      discogsScope().get('/releases/1').reply(404, { message: 'not found' });

      await enrichEntry('u1', entry({ id: 'e1' }));

      expect(persistCatalogFieldsSpy).not.toHaveBeenCalled();
    });
  });
});

describe('enrichEntries', () => {
  it('enriches multiple entries independently, one failure does not affect the others', async () => {
    discogsScope().get('/releases/1').reply(200, rawRelease);
    discogsScope().get('/releases/2').reply(404, { message: 'not found' });

    const results = await enrichEntries('u1', [
      entry({ id: 'e1', discogsReleaseId: 1 }),
      entry({ id: 'e2', discogsReleaseId: 2 }),
    ]);

    const ok = results.find((r) => r.id === 'e1');
    const unavailable = results.find((r) => r.id === 'e2');

    expect(ok?.catalogStatus).toBe('ok');
    expect(unavailable?.catalogStatus).toBe('unavailable');
    expect(unavailable?.release).toBeNull();
  });

  it('write-backs succeed for the successfully-enriched entry while the failed one is skipped', async () => {
    discogsScope().get('/releases/1').reply(200, rawRelease);
    discogsScope().get('/releases/2').reply(404, { message: 'not found' });

    await enrichEntries('u1', [
      entry({ id: 'e1', discogsReleaseId: 1 }),
      entry({ id: 'e2', discogsReleaseId: 2 }),
    ]);

    expect(persistCatalogFieldsSpy).toHaveBeenCalledTimes(1);
    expect(persistCatalogFieldsSpy).toHaveBeenCalledWith(
      'u1',
      'e1',
      expect.objectContaining({ genre: ['Jazz'] }),
    );
  });
});
