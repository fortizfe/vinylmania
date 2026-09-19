import {
  dropSharedPreviewImages,
  extractPreviewImage,
  mapFeedItem,
} from '../../../../src/domain/feeds/feedMapper';
import type { FeedSourceConfig, RawFeedItem } from '../../../../src/domain/feeds/types';

const source: FeedSourceConfig = {
  id: 'metal-injection',
  name: 'Metal Injection',
  feedUrl: 'https://metalinjection.net/feed',
  category: 'News',
  enabled: true,
  priority: true,
};

describe('mapFeedItem', () => {
  it('maps a well-formed RSS item to an Article', () => {
    const mapped = mapFeedItem(
      {
        title: 'DEVILDRIVER Unleash New Video',
        link: 'https://metalinjection.net/new-music/devildriver',
        guid: 'https://metalinjection.net/?p=643474',
        pubDate: 'Tue, 07 Jul 2026 21:17:03 +0000',
        isoDate: '2026-07-07T21:17:03.000Z',
        contentSnippet: 'Off their new album of the same name, out this Friday.',
        content:
          '<img src="https://cdn.example.com/cover.jpg" /><p>Off their new album.</p>',
      },
      source,
    );

    expect(mapped).toEqual({
      id: 'https://metalinjection.net/?p=643474',
      title: 'DEVILDRIVER Unleash New Video',
      excerpt: 'Off their new album of the same name, out this Friday.',
      imageUrl: 'https://cdn.example.com/cover.jpg',
      publishedAt: '2026-07-07T21:17:03.000Z',
      link: 'https://metalinjection.net/new-music/devildriver',
      sourceId: 'metal-injection',
      sourceName: 'Metal Injection',
      category: 'News',
    });
  });

  it('drops an item missing a title', () => {
    expect(mapFeedItem({ link: 'https://example.com/x' }, source)).toBeUndefined();
  });

  it('drops an item missing a link', () => {
    expect(mapFeedItem({ title: 'No link here' }, source)).toBeUndefined();
  });

  it('falls back to the link as id when guid is absent', () => {
    const mapped = mapFeedItem(
      { title: 'T', link: 'https://example.com/y', contentSnippet: 'x' },
      source,
    );
    expect(mapped?.id).toBe('https://example.com/y');
  });

  it('leaves imageUrl undefined when no enclosure or <img> is present', () => {
    const mapped = mapFeedItem(
      { title: 'T', link: 'https://example.com/z', contentSnippet: 'no image here' },
      source,
    );
    expect(mapped?.imageUrl).toBeUndefined();
  });

  it('prefers enclosure.url over an inline <img> when both are present', () => {
    const mapped = mapFeedItem(
      {
        title: 'T',
        link: 'https://example.com/enc',
        enclosureUrl: 'https://cdn.example.com/enclosure.jpg',
        content: '<img src="https://cdn.example.com/inline.jpg" />',
      },
      source,
    );
    expect(mapped?.imageUrl).toBe('https://cdn.example.com/enclosure.jpg');
  });

  it('extracts the first inline <img src> when there is no enclosure', () => {
    const mapped = mapFeedItem(
      {
        title: 'T',
        link: 'https://example.com/inline-only',
        content:
          '<p>intro</p><img src="https://cdn.example.com/inline.jpg" /><img src="https://cdn.example.com/second.jpg" />',
      },
      source,
    );
    expect(mapped?.imageUrl).toBe('https://cdn.example.com/inline.jpg');
  });

  it('truncates a long excerpt to 200 characters plus an ellipsis', () => {
    const longText = 'A'.repeat(300);
    const mapped = mapFeedItem(
      { title: 'T', link: 'https://example.com/long', contentSnippet: longText },
      source,
    );
    expect(mapped?.excerpt.length).toBeLessThanOrEqual(201);
  });

  describe('data-image-url extraction removed (feature 041)', () => {
    it('does not extract an image from a data-image-url attribute on any source, even well-formed markup that used to match', () => {
      const mapped = mapFeedItem(
        {
          title: 'Harlott Announce New Album',
          link: 'https://example.com/bands/news.php?id=1',
          content:
            '<a class="ms-link" href="band.php?band_id=9141" data-image-url="/images/bands/9141.jpg">Harlott</a> announce new album.',
        },
        source,
      );

      expect(mapped?.imageUrl).toBeUndefined();
    });
  });

  describe('sanitization (FR-008)', () => {
    it('strips <script> tags and executable markup from the title and excerpt, keeping the real text', () => {
      const mapped = mapFeedItem(
        {
          title: '<script>alert(1)</script>Evil Album Review',
          link: 'https://example.com/evil',
          contentSnippet: '<img src="x" onerror="alert(2)">Malicious summary text',
        },
        source,
      );

      expect(mapped?.title).not.toMatch(/[<>]/);
      expect(mapped?.title).toContain('Evil Album Review');
      expect(mapped?.excerpt).not.toMatch(/[<>]/);
      expect(mapped?.excerpt).toContain('Malicious summary text');
    });

    it('never accepts a javascript: URI as an image URL, even from an <img> tag', () => {
      const mapped = mapFeedItem(
        {
          title: 'T',
          link: 'https://example.com/xss-image',
          content: '<img src="javascript:alert(1)" onerror="alert(2)">',
        },
        source,
      );

      expect(mapped?.imageUrl).toBeUndefined();
    });

    it('never accepts a data: URI as an image URL', () => {
      const mapped = mapFeedItem(
        {
          title: 'T',
          link: 'https://example.com/data-image',
          content: '<img src="data:text/html,<script>alert(1)</script>">',
        },
        source,
      );

      expect(mapped?.imageUrl).toBeUndefined();
    });
  });

  describe('double-escaping / incomplete sanitization (spec 056 FR-002)', () => {
    it('never reconstitutes a <script> fragment from numeric-entity-obfuscated markup', () => {
      const mapped = mapFeedItem(
        {
          title: '&#38;lt;script&#38;gt;alert(1)&#38;lt;/script&#38;gt;Evil Album Review',
          link: 'https://example.com/double-escaped-script',
          contentSnippet: 'Safe summary text',
        },
        source,
      );

      expect(mapped?.title).not.toContain('<script>');
      expect(mapped?.title).not.toMatch(/[<>]/);
      expect(mapped?.title).toContain('Evil Album Review');
    });

    it('decodes a doubly-escaped ampersand exactly once, not down to a bare &', () => {
      const mapped = mapFeedItem(
        {
          title: 'T',
          link: 'https://example.com/double-escaped-ampersand',
          contentSnippet: 'Metallica &#38;amp; Slayer co-headline tour',
        },
        source,
      );

      expect(mapped?.excerpt).toBe('Metallica &amp; Slayer co-headline tour');
    });

    it('still decodes an ordinary, single-escaped ampersand correctly (regression)', () => {
      const mapped = mapFeedItem(
        {
          title: 'AC&amp;DC Tribute Album',
          link: 'https://example.com/normal-ampersand',
        },
        source,
      );

      expect(mapped?.title).toBe('AC&DC Tribute Album');
    });
  });
});

describe('mapFeedItem image discovery ladder (spec 067 D2, FR-003)', () => {
  function imageOf(fields: Partial<RawFeedItem>): string | undefined {
    return mapFeedItem(
      { title: 'T', link: 'https://example.com/ladder', ...fields },
      source,
    )?.imageUrl;
  }

  describe('enclosure', () => {
    it('uses an enclosure whose type is image/*', () => {
      expect(
        imageOf({
          enclosureUrl: 'https://cdn.example.com/cover.webp',
          enclosureType: 'image/webp',
        }),
      ).toBe('https://cdn.example.com/cover.webp');
    });

    it('skips an audio/mpeg enclosure and falls through to the next rung', () => {
      expect(
        imageOf({
          enclosureUrl: 'https://cdn.example.com/episode.mp3',
          enclosureType: 'audio/mpeg',
          content: '<img src="https://cdn.example.com/inline.jpg">',
        }),
      ).toBe('https://cdn.example.com/inline.jpg');
    });

    it('uses a typeless enclosure with an image extension', () => {
      expect(imageOf({ enclosureUrl: 'https://cdn.example.com/cover.png' })).toBe(
        'https://cdn.example.com/cover.png',
      );
    });

    it('skips a typeless enclosure without an image extension', () => {
      expect(
        imageOf({ enclosureUrl: 'https://cdn.example.com/episode.mp3' }),
      ).toBeUndefined();
    });
  });

  describe('media:content', () => {
    it('prefers a medium="image" entry over a non-image entry listed first', () => {
      expect(
        imageOf({
          mediaContent: [
            { url: 'https://cdn.example.com/clip.mp4', medium: 'video', width: 1920 },
            { url: 'https://cdn.example.com/still.jpg', medium: 'image', width: 640 },
          ],
        }),
      ).toBe('https://cdn.example.com/still.jpg');
    });

    it('treats an image/* type as an image when medium is absent', () => {
      expect(
        imageOf({
          mediaContent: [
            { url: 'https://cdn.example.com/clip.mp4', type: 'video/mp4' },
            { url: 'https://cdn.example.com/still.jpg', type: 'image/jpeg' },
          ],
        }),
      ).toBe('https://cdn.example.com/still.jpg');
    });

    it('picks the largest width among image entries', () => {
      expect(
        imageOf({
          mediaContent: [
            { url: 'https://cdn.example.com/small.jpg', medium: 'image', width: 300 },
            { url: 'https://cdn.example.com/large.jpg', medium: 'image', width: 1200 },
            { url: 'https://cdn.example.com/medium.jpg', medium: 'image', width: 800 },
          ],
        }),
      ).toBe('https://cdn.example.com/large.jpg');
    });

    // media:group children arrive already flattened into mediaContent by the
    // adapter (data-model.md); the group parsing itself is asserted in
    // feedSourceAdapter.test.ts.
  });

  it('uses media:thumbnail when there is no enclosure or media:content', () => {
    expect(imageOf({ mediaThumbnails: ['https://cdn.example.com/thumb.jpg'] })).toBe(
      'https://cdn.example.com/thumb.jpg',
    );
  });

  it('uses itunes:image when nothing above it is present', () => {
    expect(imageOf({ itunesImage: 'https://cdn.example.com/itunes.jpg' })).toBe(
      'https://cdn.example.com/itunes.jpg',
    );
  });

  it('uses the first <img> in content:encoded before one in content', () => {
    expect(
      imageOf({
        contentEncoded: '<p>x</p><img src="https://cdn.example.com/encoded.jpg">',
        content: '<img src="https://cdn.example.com/description.jpg">',
      }),
    ).toBe('https://cdn.example.com/encoded.jpg');
  });

  it('uses the first <img> in summary when content is absent', () => {
    expect(imageOf({ summary: '<img src="https://cdn.example.com/summary.jpg">' })).toBe(
      'https://cdn.example.com/summary.jpg',
    );
  });

  describe('tracking pixels (< 50 px)', () => {
    it('skips an <img width="1" height="1"> and takes the next <img>', () => {
      expect(
        imageOf({
          content:
            '<img src="https://pixel.example.com/p.gif" width="1" height="1"><img src="https://cdn.example.com/real.jpg">',
        }),
      ).toBe('https://cdn.example.com/real.jpg');
    });

    it('skips an <img> with only a small height attribute', () => {
      expect(
        imageOf({
          contentEncoded:
            '<img height="10" src="https://pixel.example.com/p.gif"><img src="https://cdn.example.com/real.jpg">',
        }),
      ).toBe('https://cdn.example.com/real.jpg');
    });

    it('keeps an <img> exactly 50 px wide', () => {
      expect(
        imageOf({ content: '<img src="https://cdn.example.com/fifty.jpg" width="50">' }),
      ).toBe('https://cdn.example.com/fifty.jpg');
    });
  });

  describe('unsafe URLs are rejected on every rung', () => {
    it.each<[string, Partial<RawFeedItem>]>([
      [
        'javascript: enclosure',
        { enclosureUrl: 'javascript:alert(1)', enclosureType: 'image/png' },
      ],
      [
        'data: media:content',
        { mediaContent: [{ url: 'data:image/png;base64,AAAA', medium: 'image' }] },
      ],
      [
        'relative media:content',
        { mediaContent: [{ url: '/images/a.jpg', medium: 'image' }] },
      ],
      ['javascript: media:thumbnail', { mediaThumbnails: ['javascript:alert(1)'] }],
      ['relative itunes:image', { itunesImage: 'images/cover.jpg' }],
      [
        'data: <img> in content:encoded',
        { contentEncoded: '<img src="data:image/gif;base64,R0lG">' },
      ],
      ['relative <img> in content', { content: '<img src="/wp-content/uploads/a.jpg">' }],
    ])('%s → no image', (_label, fields) => {
      expect(imageOf(fields)).toBeUndefined();
    });
  });

  describe('precedence when several rungs are present', () => {
    const allRungs: Partial<RawFeedItem> = {
      enclosureUrl: 'https://cdn.example.com/1-enclosure.jpg',
      enclosureType: 'image/jpeg',
      mediaContent: [{ url: 'https://cdn.example.com/2-media.jpg', medium: 'image' }],
      mediaThumbnails: ['https://cdn.example.com/3-thumb.jpg'],
      itunesImage: 'https://cdn.example.com/4-itunes.jpg',
      contentEncoded: '<img src="https://cdn.example.com/5-encoded.jpg">',
      content: '<img src="https://cdn.example.com/6-content.jpg">',
    };

    it.each<[keyof RawFeedItem | 'none', string | undefined, (keyof RawFeedItem)[]]>([
      ['none', 'https://cdn.example.com/1-enclosure.jpg', []],
      ['enclosureUrl', 'https://cdn.example.com/2-media.jpg', ['enclosureUrl']],
      [
        'mediaContent',
        'https://cdn.example.com/3-thumb.jpg',
        ['enclosureUrl', 'mediaContent'],
      ],
      [
        'mediaThumbnails',
        'https://cdn.example.com/4-itunes.jpg',
        ['enclosureUrl', 'mediaContent', 'mediaThumbnails'],
      ],
      [
        'itunesImage',
        'https://cdn.example.com/5-encoded.jpg',
        ['enclosureUrl', 'mediaContent', 'mediaThumbnails', 'itunesImage'],
      ],
      [
        'contentEncoded',
        'https://cdn.example.com/6-content.jpg',
        [
          'enclosureUrl',
          'mediaContent',
          'mediaThumbnails',
          'itunesImage',
          'contentEncoded',
        ],
      ],
    ])('removing rungs up to %s yields %s', (_label, expected, removed) => {
      const fields: Partial<RawFeedItem> = { ...allRungs };
      for (const key of removed) {
        delete fields[key];
      }
      expect(imageOf(fields)).toBe(expected);
    });
  });
});

describe('extractPreviewImage (spec 067 D3)', () => {
  const baseUrl = 'https://site.example.com/2026/09/18/post/';

  function head(meta: string): string {
    return `<html><head><title>Post</title>${meta}</head><body></body></html>`;
  }

  it('reads og:image with property before content', () => {
    expect(
      extractPreviewImage(
        head('<meta property="og:image" content="https://cdn.example.com/og.jpg" />'),
        baseUrl,
      ),
    ).toBe('https://cdn.example.com/og.jpg');
  });

  it('reads og:image with content before property', () => {
    expect(
      extractPreviewImage(
        head('<meta content="https://cdn.example.com/og.jpg" property="og:image">'),
        baseUrl,
      ),
    ).toBe('https://cdn.example.com/og.jpg');
  });

  it('falls back to twitter:image (name attribute, either order)', () => {
    expect(
      extractPreviewImage(
        head('<meta name="twitter:image" content="https://cdn.example.com/tw.jpg">'),
        baseUrl,
      ),
    ).toBe('https://cdn.example.com/tw.jpg');
    expect(
      extractPreviewImage(
        head('<meta content="https://cdn.example.com/tw2.jpg" name="twitter:image">'),
        baseUrl,
      ),
    ).toBe('https://cdn.example.com/tw2.jpg');
  });

  it('prefers og:image over twitter:image even when twitter:image comes first', () => {
    expect(
      extractPreviewImage(
        head(
          '<meta name="twitter:image" content="https://cdn.example.com/tw.jpg"><meta property="og:image" content="https://cdn.example.com/og.jpg">',
        ),
        baseUrl,
      ),
    ).toBe('https://cdn.example.com/og.jpg');
  });

  it('ignores og:image:width / og:image:alt siblings', () => {
    expect(
      extractPreviewImage(
        head(
          '<meta property="og:image:width" content="1200"><meta property="og:image:alt" content="cover"><meta property="og:image" content="https://cdn.example.com/og.jpg">',
        ),
        baseUrl,
      ),
    ).toBe('https://cdn.example.com/og.jpg');
  });

  it('decodes &amp; in the content URL', () => {
    expect(
      extractPreviewImage(
        head(
          '<meta property="og:image" content="https://cdn.example.com/i.jpg?w=1200&amp;h=630">',
        ),
        baseUrl,
      ),
    ).toBe('https://cdn.example.com/i.jpg?w=1200&h=630');
  });

  it('resolves a relative URL against baseUrl', () => {
    expect(
      extractPreviewImage(
        head('<meta property="og:image" content="/uploads/cover.jpg">'),
        baseUrl,
      ),
    ).toBe('https://site.example.com/uploads/cover.jpg');
  });

  it.each([
    'javascript:alert(1)',
    'data:image/png;base64,AAAA',
    'ftp://cdn.example.com/a.jpg',
  ])('rejects a non-http(s) URL (%s)', (url) => {
    expect(
      extractPreviewImage(head(`<meta property="og:image" content="${url}">`), baseUrl),
    ).toBeUndefined();
  });

  it('returns undefined when there is no preview meta', () => {
    expect(
      extractPreviewImage(
        head('<meta name="description" content="nothing here">'),
        baseUrl,
      ),
    ).toBeUndefined();
  });
});

describe('dropSharedPreviewImages (spec 067 D6, FR-005)', () => {
  const LOGO = 'https://site.example.com/horns-512.png';

  it('nulls a URL shared by 2+ links and keeps unique URLs and existing nulls', () => {
    const results = new Map<string, string | null>([
      ['https://site.example.com/a', LOGO],
      ['https://site.example.com/b', LOGO],
      ['https://site.example.com/c', LOGO],
      ['https://site.example.com/d', 'https://cdn.example.com/unique-d.jpg'],
      ['https://site.example.com/e', null],
    ]);

    const filtered = dropSharedPreviewImages(results);

    expect(Object.fromEntries(filtered)).toEqual({
      'https://site.example.com/a': null,
      'https://site.example.com/b': null,
      'https://site.example.com/c': null,
      'https://site.example.com/d': 'https://cdn.example.com/unique-d.jpg',
      'https://site.example.com/e': null,
    });
  });

  it('keeps a map of unique URLs unchanged', () => {
    const results = new Map<string, string | null>([
      ['https://site.example.com/a', 'https://cdn.example.com/a.jpg'],
      ['https://site.example.com/b', 'https://cdn.example.com/b.jpg'],
    ]);

    expect(Object.fromEntries(dropSharedPreviewImages(results))).toEqual(
      Object.fromEntries(results),
    );
  });

  it('does not mutate the input map', () => {
    const results = new Map<string, string | null>([
      ['https://site.example.com/a', LOGO],
      ['https://site.example.com/b', LOGO],
    ]);
    const before = Object.fromEntries(results);

    dropSharedPreviewImages(results);

    expect(Object.fromEntries(results)).toEqual(before);
  });
});
