import 'package:flutter_test/flutter_test.dart';

import '../../helpers/fixtures/collection_stats_fixtures.dart';
import '../../helpers/fixtures/discogs_fixtures.dart';
import '../../helpers/fixtures/feeds_fixtures.dart';
import '../../helpers/fixtures/streaming_fixtures.dart';
import '../../helpers/fixtures/wantlist_fixtures.dart';

void main() {
  group('wantlist', () {
    test('WantEntry maps populated and minimal entries', () {
      expect(wantEntry.discogsReleaseId, 249504);
      expect(wantEntry.rating, 3);
      expect(wantEntry.notes, 'Find the first press');
      expect(wantEntry.addedAt, DateTime.utc(2024, 6, 1, 12));
      expect(wantEntry.isCatalogAvailable, isTrue);
      expect(wantEntry.release!.discogsId, 249504);

      expect(minimalWantEntry.notes, isNull);
      expect(minimalWantEntry.isCatalogAvailable, isFalse);
      expect(minimalWantEntry.release, isNull);
    });

    test('WantEntryDetail maps populated and minimal details', () {
      expect(wantEntryDetail.discogsReleaseId, 249504);
      expect(wantEntryDetail.rating, 3);
      expect(wantEntryDetail.notes, 'Find the first press');
      expect(wantEntryDetail.addedAt, DateTime.utc(2024, 6, 1, 12));
      expect(minimalWantEntryDetail.notes, isNull);
    });

    test('AddToWantlistResult carries the entry and both flags', () {
      expect(addToWantlistResult.entry.discogsReleaseId, 249504);
      expect(addToWantlistResult.alreadyInWantlist, isFalse);
      expect(addToWantlistResult.alreadyInLibrary, isTrue);
    });
  });

  group('feeds', () {
    test('FeedsDashboard maps categories, articles and source statuses', () {
      final metal = feedsDashboard.categories.first;
      expect(metal.category, 'Metal');
      final article = metal.articles.single;
      expect(article.id, 'a1');
      expect(article.title, 'Metallica announce reissue');
      expect(article.excerpt, startsWith('The band'));
      expect(article.imageUrl, 'https://img.example/news.jpg');
      expect(article.publishedAt, DateTime.utc(2024, 6, 2, 9));
      expect(article.link, 'https://news.example/metallica');
      expect(article.sourceId, 'metal-hammer');
      expect(article.sourceName, 'Metal Hammer');
      expect(article.category, 'Metal');
      expect(feedsDashboard.categories.last.articles.single.imageUrl, isNull);

      final [hammer, stone] = feedsDashboard.sourceStatuses;
      expect(hammer.sourceId, 'metal-hammer');
      expect(hammer.sourceName, 'Metal Hammer');
      expect(hammer.isAvailable, isTrue);
      expect(hammer.priority, isTrue);
      expect(stone.isAvailable, isFalse);
      expect(stone.priority, isFalse);
      expect(feedsDashboard.generatedAt, DateTime.utc(2024, 6, 2, 10));

      expect(minimalFeedsDashboard.categories, isEmpty);
      expect(minimalFeedsDashboard.sourceStatuses, isEmpty);
    });

    test('SourceFeed maps available and unavailable sources', () {
      expect(sourceFeed.sourceId, 'metal-hammer');
      expect(sourceFeed.sourceName, 'Metal Hammer');
      expect(sourceFeed.isAvailable, isTrue);
      expect(sourceFeed.articles.single.id, 'a1');
      expect(sourceFeed.generatedAt, DateTime.utc(2024, 6, 2, 10));

      expect(minimalSourceFeed.isAvailable, isFalse);
      expect(minimalSourceFeed.articles, isEmpty);
    });
  });

  test('StreamingLink maps platform and url', () {
    expect(streamingLink.platform, 'apple_music');
    expect(streamingLink.url, 'https://music.apple.com/album/123');
  });

  group('collection stats', () {
    test('CollectionStatistics maps breakdowns, artists and growth', () {
      final s = collectionStatistics;
      expect(s.totalRecords, 39);
      expect(s.byGenre.buckets.first.label, 'Rock');
      expect(s.byGenre.buckets.first.count, 30);
      expect(s.byGenre.others, (count: 4, hiddenBuckets: 2));
      expect(s.byDecade.buckets, hasLength(2));
      expect(s.byStyle.buckets, hasLength(2));
      expect(s.byLabel.buckets, hasLength(2));
      expect(s.topArtists.map((a) => (a.name, a.count)), [
        ('Metallica', 6),
        ('Slayer', 3),
      ]);
      expect(s.mostPresentArtist!.name, 'Metallica');
      expect(s.growth.map((p) => (p.period, p.added, p.cumulative)), [
        ('2024-04', 2, 37),
        ('2024-05', 2, 39),
      ]);
    });

    test('CollectionStatistics maps an empty collection', () {
      final s = minimalCollectionStatistics;
      expect(s.totalRecords, 0);
      expect(s.byGenre.buckets, isEmpty);
      expect(s.byGenre.others, isNull);
      expect(s.topArtists, isEmpty);
      expect(s.mostPresentArtist, isNull);
      expect(s.growth, isEmpty);
    });

    test('ValuationChunk maps a complete chunk with per-disc values', () {
      final c = completeValuationChunk;
      expect(c.status, 'complete');
      expect(c.nextCursor, isNull);
      expect(c.pricedThisBatch, 2);
      expect(c.fromCacheThisBatch, 1);
      expect(c.retryable, 1);

      final v = c.valuation;
      expect(v.currency, 'EUR');
      expect(v.estimatedTotal, 120.0);
      expect(v.coveredCount, 3);
      expect(v.totalCount, 5);
      expect(v.uncovered, (noMarketData: 1, noCondition: 1));
      expect(v.status, 'complete');
      expect(v.topValuable.single.value, 45.5);

      final [covered, uncovered] = c.perDisc!;
      expect(covered.releaseId, 249504);
      expect(covered.instanceId, 900);
      expect(covered.title, 'Master Of Puppets');
      expect(covered.artist, 'Metallica');
      expect(covered.mediaCondition, 'Near Mint (NM or M-)');
      expect(covered.reason, 'ok');
      expect(uncovered.value, isNull);
      expect(uncovered.mediaCondition, isNull);
      expect(uncovered.reason, 'no_condition');
    });

    test('ValuationChunk maps a partial chunk', () {
      final c = partialValuationChunk;
      expect(c.status, 'partial');
      expect(c.nextCursor, 25);
      expect(c.retryable, 0);
      expect(c.perDisc, isNull);
      expect(c.valuation.currency, isNull);
      expect(c.valuation.topValuable, isEmpty);
    });
  });

  test('DiscogsConnectionStatus maps connected and disconnected', () {
    expect(connectedStatus.connected, isTrue);
    expect(connectedStatus.discogsUsername, 'vinyl_fan');
    expect(connectedStatus.linkedAt, DateTime.utc(2024, 3, 10, 18));
    expect(disconnectedStatus.connected, isFalse);
    expect(disconnectedStatus.discogsUsername, isNull);
    expect(disconnectedStatus.linkedAt, isNull);
  });
}
