import type { LookupAddress } from 'node:dns';
import { isIP } from 'node:net';
import { Readable } from 'node:stream';

import axios from 'axios';
import nock from 'nock';

import {
  fetchArticleHead,
  fetchFeed,
  feedSourceAdapter,
} from '../../../../src/adapters/feeds/feedSourceAdapter';
import { logger } from '../../../../src/config/logger';

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

describe('fetchFeed image fields (spec 067 D1, FR-002)', () => {
  afterEach(() => {
    nock.cleanAll();
  });

  it('maps Media RSS, iTunes, content:encoded and a typed enclosure from an RSS 2.0 feed', async () => {
    nock(FEED_ORIGIN)
      .get('/hmo-rss')
      .reply(
        200,
        `<?xml version="1.0" encoding="UTF-8"?>
        <rss version="2.0"
          xmlns:media="http://search.yahoo.com/mrss/"
          xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd"
          xmlns:content="http://purl.org/rss/1.0/modules/content/">
          <channel><title>Heavy Metal Overload-ish</title>
            <item>
              <title>Review One</title>
              <link>https://hmo.example/review-one</link>
              <media:content url="https://hmo.example/img/one-large.jpg" medium="image" type="image/jpeg" width="1200" />
              <media:thumbnail url="https://hmo.example/img/one-thumb.jpg" />
              <itunes:image href="https://hmo.example/img/one-itunes.jpg" />
              <content:encoded><![CDATA[<p>Body</p><img src="https://hmo.example/img/one-body.jpg" />]]></content:encoded>
              <enclosure url="https://hmo.example/img/one-enclosure.jpg" type="image/jpeg" length="12345" />
            </item>
            <item>
              <title>Review Two</title>
              <link>https://hmo.example/review-two</link>
              <media:group>
                <media:content url="https://hmo.example/img/two-small.jpg" medium="image" width="300" />
                <media:content url="https://hmo.example/img/two-large.jpg" medium="image" width="1000" />
              </media:group>
            </item>
          </channel>
        </rss>`,
        { 'Content-Type': 'application/rss+xml' },
      );

    const [one, two] = await fetchFeed(`${FEED_ORIGIN}/hmo-rss`);

    expect(one.mediaContent).toEqual([
      {
        url: 'https://hmo.example/img/one-large.jpg',
        medium: 'image',
        type: 'image/jpeg',
        width: 1200,
      },
    ]);
    expect(one.mediaThumbnails).toEqual(['https://hmo.example/img/one-thumb.jpg']);
    expect(one.itunesImage).toBe('https://hmo.example/img/one-itunes.jpg');
    expect(one.contentEncoded).toContain(
      '<img src="https://hmo.example/img/one-body.jpg"',
    );
    expect(one.enclosureUrl).toBe('https://hmo.example/img/one-enclosure.jpg');
    expect(one.enclosureType).toBe('image/jpeg');

    expect(two.mediaContent).toEqual([
      { url: 'https://hmo.example/img/two-small.jpg', medium: 'image', width: 300 },
      { url: 'https://hmo.example/img/two-large.jpg', medium: 'image', width: 1000 },
    ]);
  });

  it('maps an Atom <link rel="enclosure"> and media:thumbnail', async () => {
    nock(FEED_ORIGIN)
      .get('/atom')
      .reply(
        200,
        `<?xml version="1.0" encoding="UTF-8"?>
        <feed xmlns="http://www.w3.org/2005/Atom" xmlns:media="http://search.yahoo.com/mrss/">
          <title>Atom Test</title>
          <id>urn:atom-test</id>
          <updated>2026-09-18T10:00:00Z</updated>
          <entry>
            <title>Atom Entry</title>
            <id>urn:atom-test:1</id>
            <updated>2026-09-18T10:00:00Z</updated>
            <link rel="alternate" href="https://atom.example/entry-1" />
            <link rel="enclosure" type="image/jpeg" href="https://atom.example/img/entry-1.jpg" />
            <media:thumbnail url="https://atom.example/img/entry-1-thumb.jpg" />
          </entry>
        </feed>`,
        { 'Content-Type': 'application/atom+xml' },
      );

    const [entry] = await fetchFeed(`${FEED_ORIGIN}/atom`);

    expect(entry.link).toBe('https://atom.example/entry-1');
    expect(entry.enclosureUrl).toBe('https://atom.example/img/entry-1.jpg');
    expect(entry.enclosureType).toBe('image/jpeg');
    expect(entry.mediaThumbnails).toEqual(['https://atom.example/img/entry-1-thumb.jpg']);
  });
});

describe('fetchArticleHead (spec 067 D3, FR-004a)', () => {
  const ARTICLE_ORIGIN = 'https://article-head-test.example';
  const PUBLIC_ADDRESS: LookupAddress = { address: '93.184.216.34', family: 4 };
  const HTML = { 'Content-Type': 'text/html; charset=utf-8' };

  /** Fake resolver: IP literals resolve to themselves, named hosts per the map, else public. */
  function fakeResolver(hosts: Record<string, LookupAddress[]> = {}) {
    return jest.fn(async (host: string): Promise<LookupAddress[]> => {
      const family = isIP(host);
      if (family) {
        return [{ address: host, family }];
      }
      return hosts[host] ?? [PUBLIC_ADDRESS];
    });
  }

  beforeAll(() => {
    nock.disableNetConnect();
  });

  afterAll(() => {
    nock.enableNetConnect();
  });

  afterEach(() => {
    nock.cleanAll();
  });

  it('is exposed on the feedSourceAdapter port object', () => {
    expect(typeof fetchArticleHead).toBe('function');
    expect(feedSourceAdapter.fetchArticleHead).toBe(fetchArticleHead);
  });

  it('returns the <head> HTML of a page on a public address', async () => {
    nock(ARTICLE_ORIGIN)
      .get('/post')
      .reply(200, '<html><head><title>Post</title></head><body>body</body></html>', HTML);
    const resolve = fakeResolver();

    const html = await fetchArticleHead(`${ARTICLE_ORIGIN}/post`, 1000, resolve);

    expect(html).toContain('<title>Post</title>');
    expect(resolve).toHaveBeenCalledWith('article-head-test.example');
  });

  it('bypasses any HTTP(S)_PROXY and connects to the validated, pinned address', async () => {
    nock(ARTICLE_ORIGIN).get('/post').reply(200, '<html><head></head>', HTML);
    const getSpy = jest.spyOn(axios, 'get');

    await fetchArticleHead(`${ARTICLE_ORIGIN}/post`, 1000, fakeResolver());

    const config = getSpy.mock.calls[0][1] as {
      proxy?: unknown;
      lookup?: (host: string, opts: object, cb: (...args: unknown[]) => void) => void;
    };
    getSpy.mockRestore();
    expect(config.proxy).toBe(false);
    const callback = jest.fn();
    config.lookup?.('article-head-test.example', {}, callback);
    expect(callback).toHaveBeenCalledWith(null, PUBLIC_ADDRESS.address, 4);
  });

  describe('blocked addresses', () => {
    it.each<[string, number]>([
      ['10.0.0.5', 4],
      ['127.0.0.1', 4],
      ['169.254.169.254', 4],
      ['::1', 6],
      ['fd00:ec2::254', 6],
      ['::ffff:127.0.0.1', 6],
      ['64:ff9b::7f00:1', 6], // NAT64
      ['2002:7f00:1::', 6], // 6to4
      ['::7f00:1', 6], // IPv4-compatible
      ['2001:0:4136:e378:8000:63bf:3fff:fdd2', 6], // Teredo
    ])(
      'returns null without requesting when the host resolves to %s',
      async (address, family) => {
        const scope = nock(ARTICLE_ORIGIN)
          .get('/post')
          .reply(200, '<html><head></head>', HTML);
        const resolve = fakeResolver({
          'article-head-test.example': [{ address, family }],
        });

        await expect(
          fetchArticleHead(`${ARTICLE_ORIGIN}/post`, 1000, resolve),
        ).resolves.toBeNull();
        expect(scope.isDone()).toBe(false);
      },
    );

    it('returns null when any one of several resolved addresses is private', async () => {
      const scope = nock(ARTICLE_ORIGIN)
        .get('/post')
        .reply(200, '<html><head></head>', HTML);
      const resolve = fakeResolver({
        'article-head-test.example': [
          PUBLIC_ADDRESS,
          { address: '192.168.1.10', family: 4 },
        ],
      });

      await expect(
        fetchArticleHead(`${ARTICLE_ORIGIN}/post`, 1000, resolve),
      ).resolves.toBeNull();
      expect(scope.isDone()).toBe(false);
    });

    it('logs the blocked host at warn with outcome validation_error', async () => {
      const warnSpy = jest.spyOn(logger, 'warn');
      const resolve = fakeResolver({
        'article-head-test.example': [{ address: '10.0.0.5', family: 4 }],
      });

      await fetchArticleHead(`${ARTICLE_ORIGIN}/post`, 1000, resolve);

      expect(warnSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          outcome: 'validation_error',
          meta: expect.objectContaining({ host: 'article-head-test.example' }),
        }),
      );
      warnSpy.mockRestore();
    });
  });

  it('returns null for a non-http(s) URL without resolving it', async () => {
    const resolve = fakeResolver();

    await expect(
      fetchArticleHead('ftp://article-head-test.example/post', 1000, resolve),
    ).resolves.toBeNull();
    expect(resolve).not.toHaveBeenCalled();
  });

  describe('redirects', () => {
    it.each([
      [
        'a host that resolves private',
        'https://internal.example/admin',
        'https://internal.example',
      ],
      [
        'a metadata IP literal',
        'http://169.254.169.254/latest/meta-data/',
        'http://169.254.169.254',
      ],
    ])('returns null on a 302 to %s', async (_label, location, targetOrigin) => {
      nock(ARTICLE_ORIGIN).get('/redirect').reply(302, '', { Location: location });
      const target = nock(targetOrigin)
        .get(new URL(location).pathname)
        .reply(200, '<html><head></head>', HTML);
      const resolve = fakeResolver({
        'internal.example': [{ address: '10.1.2.3', family: 4 }],
      });

      await expect(
        fetchArticleHead(`${ARTICLE_ORIGIN}/redirect`, 1000, resolve),
      ).resolves.toBeNull();
      expect(target.isDone()).toBe(false);
    });

    it('follows up to 3 redirects to a public page', async () => {
      nock(ARTICLE_ORIGIN)
        .get('/r0')
        .reply(301, '', { Location: `${ARTICLE_ORIGIN}/r1` })
        .get('/r1')
        .reply(302, '', { Location: '/r2' })
        .get('/r2')
        .reply(307, '', { Location: `${ARTICLE_ORIGIN}/final` })
        .get('/final')
        .reply(200, '<html><head><title>Final</title></head>', HTML);

      const html = await fetchArticleHead(`${ARTICLE_ORIGIN}/r0`, 1000, fakeResolver());

      expect(html).toContain('<title>Final</title>');
    });

    it('returns null on a 4th redirect without following it', async () => {
      nock(ARTICLE_ORIGIN)
        .get('/r0')
        .reply(302, '', { Location: `${ARTICLE_ORIGIN}/r1` })
        .get('/r1')
        .reply(302, '', { Location: `${ARTICLE_ORIGIN}/r2` })
        .get('/r2')
        .reply(302, '', { Location: `${ARTICLE_ORIGIN}/r3` })
        .get('/r3')
        .reply(302, '', { Location: `${ARTICLE_ORIGIN}/r4` });
      const fifth = nock(ARTICLE_ORIGIN)
        .get('/r4')
        .reply(200, '<html><head><title>Too far</title></head>', HTML);

      await expect(
        fetchArticleHead(`${ARTICLE_ORIGIN}/r0`, 1000, fakeResolver()),
      ).resolves.toBeNull();
      expect(fifth.isDone()).toBe(false);
    });
  });

  it('returns null for a non-HTML content-type', async () => {
    nock(ARTICLE_ORIGIN)
      .get('/api')
      .reply(
        200,
        { image: 'https://cdn.example.com/x.jpg' },
        { 'Content-Type': 'application/json' },
      );

    await expect(
      fetchArticleHead(`${ARTICLE_ORIGIN}/api`, 1000, fakeResolver()),
    ).resolves.toBeNull();
  });

  it('returns null on a 404', async () => {
    nock(ARTICLE_ORIGIN).get('/gone').reply(404, '<html><head></head>', HTML);

    await expect(
      fetchArticleHead(`${ARTICLE_ORIGIN}/gone`, 1000, fakeResolver()),
    ).resolves.toBeNull();
  });

  describe('transient failures reject', () => {
    it('rejects on a 503', async () => {
      nock(ARTICLE_ORIGIN).get('/busy').reply(503, 'busy', HTML);

      await expect(
        fetchArticleHead(`${ARTICLE_ORIGIN}/busy`, 1000, fakeResolver()),
      ).rejects.toThrow();
    });

    it('rejects when the reply is delayed beyond timeoutMs', async () => {
      nock(ARTICLE_ORIGIN)
        .get('/slow')
        .delay(300)
        .reply(200, '<html><head></head>', HTML);

      await expect(
        fetchArticleHead(`${ARTICLE_ORIGIN}/slow`, 50, fakeResolver()),
      ).rejects.toThrow();
    });

    it('rejects within timeoutMs when the resolver itself is slower than timeoutMs', async () => {
      const scope = nock(ARTICLE_ORIGIN)
        .get('/post')
        .reply(200, '<html><head></head>', HTML);
      const slowResolve = jest.fn(
        () =>
          new Promise<LookupAddress[]>((resolve) => {
            setTimeout(() => resolve([PUBLIC_ADDRESS]), 2000).unref();
          }),
      );
      const startedAt = Date.now();

      await expect(
        fetchArticleHead(`${ARTICLE_ORIGIN}/post`, 50, slowResolve),
      ).rejects.toThrow();
      expect(Date.now() - startedAt).toBeLessThan(1000);
      expect(scope.isDone()).toBe(false);
    });
  });

  it('returns at most 256 KB of a 300 KB page with no </head>', async () => {
    const body = `<html><head><title>Huge</title>${'a'.repeat(300 * 1024)}`;
    nock(ARTICLE_ORIGIN).get('/huge').reply(200, body, HTML);

    const html = await fetchArticleHead(`${ARTICLE_ORIGIN}/huge`, 1000, fakeResolver());

    expect(html).not.toBeNull();
    expect(Buffer.byteLength(html as string)).toBeLessThanOrEqual(256 * 1024);
  });

  it('returns as soon as og:image is seen, without reading the rest of the page', async () => {
    async function* chunks() {
      yield '<html><head><meta property="og:image" content="https://cdn.example.com/og.jpg">';
      // The rest of a long <head> (Femme Metal: </head> at ~153 KB) only
      // arrives much later; a reader that waits for it would blow the timing
      // assertion below.
      await new Promise((resolve) => setTimeout(resolve, 2000).unref());
      yield `${'b'.repeat(10 * 1024)}LATER-CHUNK</head><body></body></html>`;
    }
    nock(ARTICLE_ORIGIN)
      .get('/early-og')
      .reply(200, () => Readable.from(chunks()), HTML);
    const startedAt = Date.now();

    const html = await fetchArticleHead(
      `${ARTICLE_ORIGIN}/early-og`,
      5000,
      fakeResolver(),
    );

    expect(Date.now() - startedAt).toBeLessThan(1000);
    expect(html).toContain('https://cdn.example.com/og.jpg');
    expect(html).not.toContain('LATER-CHUNK');
  });
});
