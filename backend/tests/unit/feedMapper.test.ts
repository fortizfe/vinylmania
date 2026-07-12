import { mapFeedItem } from '../../src/feeds/feedMapper';
import type { FeedSourceConfig } from '../../src/feeds/types';

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
        enclosure: { url: 'https://cdn.example.com/enclosure.jpg' },
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

  describe('Metal Storm data-image-url extraction (spec 036)', () => {
    const metalStormSource: FeedSourceConfig = {
      id: 'metal-storm-news',
      name: 'Metal Storm',
      feedUrl: 'https://metalstorm.net/rss/news.xml',
      category: 'News',
      enabled: true,
      priority: false,
    };

    it('resolves a relative data-image-url on an <a class="ms-link"> anchor to an absolute URL', () => {
      const mapped = mapFeedItem(
        {
          title: 'Harlott Announce New Album',
          link: 'https://metalstorm.net/bands/news.php?id=1',
          content:
            '<a class="ms-link" href="band.php?band_id=9141" data-image-url="/images/bands/9141.jpg">Harlott</a> announce new album.',
        },
        metalStormSource,
      );

      expect(mapped?.imageUrl).toBe('https://metalstorm.net/images/bands/9141.jpg');
    });

    it('takes the first ms-link anchor when an item has more than one', () => {
      const mapped = mapFeedItem(
        {
          title: 'Two Bands Mentioned',
          link: 'https://metalstorm.net/bands/news.php?id=2',
          content:
            '<a class="ms-link" data-image-url="/images/bands/1.jpg">Band One</a> and ' +
            '<a class="ms-link" data-image-url="/images/albums/2/2.jpg">Album Two</a>.',
        },
        metalStormSource,
      );

      expect(mapped?.imageUrl).toBe('https://metalstorm.net/images/bands/1.jpg');
    });

    it('leaves imageUrl undefined for a Metal Storm category with no ms-link/data-image-url markup (e.g. Reviews)', () => {
      const metalStormReviews: FeedSourceConfig = {
        ...metalStormSource,
        id: 'metal-storm-reviews',
        category: 'Reviews',
        feedUrl: 'https://metalstorm.net/rss/reviews.xml',
      };

      const mapped = mapFeedItem(
        {
          title: 'Album Review',
          link: 'https://metalstorm.net/reviews/review.php?id=1',
          content: '<i>A review with no images at all.</i> <a href="review.php?id=1">Read more…</a>',
        },
        metalStormReviews,
      );

      expect(mapped?.imageUrl).toBeUndefined();
    });

    it('rejects a protocol-relative data-image-url instead of resolving it to an external host', () => {
      const mapped = mapFeedItem(
        {
          title: 'Suspicious Feed Item',
          link: 'https://metalstorm.net/bands/news.php?id=3',
          content: '<a class="ms-link" data-image-url="//evil.com/x.jpg">Band</a>',
        },
        metalStormSource,
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
});
