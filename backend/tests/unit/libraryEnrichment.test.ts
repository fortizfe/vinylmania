import { discogsScope } from '../helpers/nock';
import { MAX_ATTEMPTS } from '../../src/discogs/discogsRetry';
import { enrichEntries, enrichEntry } from '../../src/library/libraryEnrichment';
import type { LibraryEntry } from '../../src/library/types';

const rawRelease = {
  id: 1,
  title: 'Stockholm',
  year: 1999,
  artists: [{ id: 1, name: 'The Persuader', anv: '', join: '', role: '' }],
  labels: [],
  formats: [{ name: 'Vinyl', descriptions: [] }],
  genres: [],
  styles: [],
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

describe('enrichEntry', () => {
  it('merges a successfully-fetched release with catalogStatus ok', async () => {
    discogsScope().get('/releases/1').reply(200, rawRelease);

    const result = await enrichEntry(entry({}));

    expect(result.catalogStatus).toBe('ok');
    expect(result.release?.title).toBe('Stockholm');
  });

  it('sets catalogStatus unavailable and release null when Discogs 404s', async () => {
    discogsScope().get('/releases/1').reply(404, { message: 'not found' });

    const result = await enrichEntry(entry({}));

    expect(result.catalogStatus).toBe('unavailable');
    expect(result.release).toBeNull();
  });

  it('sets catalogStatus unavailable when Discogs errors', async () => {
    discogsScope()
      .get('/releases/1')
      .times(MAX_ATTEMPTS)
      .reply(500, { message: 'server error' });

    const result = await enrichEntry(entry({}));

    expect(result.catalogStatus).toBe('unavailable');
    expect(result.release).toBeNull();
  });
});

describe('enrichEntries', () => {
  it('enriches multiple entries independently, one failure does not affect the others', async () => {
    discogsScope().get('/releases/1').reply(200, rawRelease);
    discogsScope().get('/releases/2').reply(404, { message: 'not found' });

    const results = await enrichEntries([
      entry({ id: 'e1', discogsReleaseId: 1 }),
      entry({ id: 'e2', discogsReleaseId: 2 }),
    ]);

    const ok = results.find((r) => r.id === 'e1');
    const unavailable = results.find((r) => r.id === 'e2');

    expect(ok?.catalogStatus).toBe('ok');
    expect(unavailable?.catalogStatus).toBe('unavailable');
    expect(unavailable?.release).toBeNull();
  });
});
