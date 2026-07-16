import nock from 'nock';

import { fetchFeed } from '../../../../src/adapters/feeds/feedSourceAdapter';

const FEED_ORIGIN = 'https://feed-client-test.example';

describe('fetchFeed', () => {
  afterEach(() => {
    nock.cleanAll();
  });

  it('fetches a feed URL and parses its items', async () => {
    nock(FEED_ORIGIN)
      .get('/rss')
      .reply(
        200,
        `<?xml version="1.0" encoding="UTF-8"?>
        <rss version="2.0"><channel><title>Test Feed</title>
          <item>
            <title>Item One</title>
            <link>https://example.com/1</link>
            <pubDate>Tue, 07 Jul 2026 00:00:00 GMT</pubDate>
          </item>
        </channel></rss>`,
        { 'Content-Type': 'application/rss+xml' },
      );

    const feed = await fetchFeed(`${FEED_ORIGIN}/rss`);

    expect(feed).toHaveLength(1);
    expect(feed[0].title).toBe('Item One');
    expect(feed[0].link).toBe('https://example.com/1');
  });

  it('rejects when the source responds with a server error', async () => {
    nock(FEED_ORIGIN).get('/rss-error').reply(500);

    await expect(fetchFeed(`${FEED_ORIGIN}/rss-error`)).rejects.toThrow();
  });

  it('rejects when the response exceeds the given timeout', async () => {
    nock(FEED_ORIGIN)
      .get('/rss-slow')
      .delay(200)
      .reply(200, '<rss version="2.0"><channel></channel></rss>');

    await expect(fetchFeed(`${FEED_ORIGIN}/rss-slow`, 50)).rejects.toThrow();
  });

  it('rejects on a network-level error (e.g. connection reset)', async () => {
    nock(FEED_ORIGIN).get('/rss-network-error').replyWithError('connection reset');

    await expect(fetchFeed(`${FEED_ORIGIN}/rss-network-error`)).rejects.toThrow();
  });
});
