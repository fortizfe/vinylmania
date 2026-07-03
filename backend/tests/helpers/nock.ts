import nock from 'nock';

export const DISCOGS_BASE_URL = 'https://api.discogs.com';

beforeAll(() => {
  nock.disableNetConnect();
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
