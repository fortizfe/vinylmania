import nock from 'nock';

export const DISCOGS_BASE_URL = 'https://api.discogs.com';

beforeAll(() => {
  // Block all real network except localhost, so supertest can still reach
  // the in-process Express app under test while Discogs calls stay mocked.
  nock.disableNetConnect();
  nock.enableNetConnect((host) => host.includes('127.0.0.1') || host.includes('localhost'));
});

afterEach(() => {
  nock.cleanAll();
});

afterAll(() => {
  nock.enableNetConnect();
});

export function discogsScope(): nock.Scope {
  return nock(DISCOGS_BASE_URL);
}
