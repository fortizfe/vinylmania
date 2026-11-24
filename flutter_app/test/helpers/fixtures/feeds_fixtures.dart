import 'package:vinylmania/domain/models/feeds/feeds_dashboard.dart';
import 'package:vinylmania/domain/models/feeds/source_feed.dart';

/// Wire shapes of `/api/feeds/*` (frontend/src/services/feedsApi.ts).

const articleJson = <String, Object?>{
  'id': 'a1',
  'title': 'Metallica announce reissue',
  'excerpt': 'The band revisits its 1986 classic.',
  'imageUrl': 'https://img.example/news.jpg',
  'publishedAt': '2024-06-02T09:00:00.000Z',
  'link': 'https://news.example/metallica',
  'sourceId': 'metal-hammer',
  'sourceName': 'Metal Hammer',
  'category': 'Metal',
};

const minimalArticleJson = <String, Object?>{
  'id': 'a2',
  'title': 'Short news',
  'excerpt': '',
  'publishedAt': '2024-06-01T09:00:00.000Z',
  'link': 'https://news.example/short',
  'sourceId': 'rolling-stone',
  'sourceName': 'Rolling Stone',
  'category': 'Rock',
};

const dashboardJson = <String, Object?>{
  'categories': [
    {
      'category': 'Metal',
      'articles': [articleJson],
    },
    {
      'category': 'Rock',
      'articles': [minimalArticleJson],
    },
  ],
  'sourceStatuses': [
    {
      'sourceId': 'metal-hammer',
      'sourceName': 'Metal Hammer',
      'status': 'ok',
      'priority': true,
    },
    {
      'sourceId': 'rolling-stone',
      'sourceName': 'Rolling Stone',
      'status': 'unavailable',
      'priority': false,
    },
  ],
  'generatedAt': '2024-06-02T10:00:00.000Z',
};

const minimalDashboardJson = <String, Object?>{
  'categories': <Object?>[],
  'sourceStatuses': <Object?>[],
  'generatedAt': '2024-06-02T10:00:00.000Z',
};

const sourceFeedJson = <String, Object?>{
  'sourceId': 'metal-hammer',
  'sourceName': 'Metal Hammer',
  'status': 'ok',
  'articles': [articleJson],
  'generatedAt': '2024-06-02T10:00:00.000Z',
};

const minimalSourceFeedJson = <String, Object?>{
  'sourceId': 'rolling-stone',
  'sourceName': 'Rolling Stone',
  'status': 'unavailable',
  'articles': <Object?>[],
  'generatedAt': '2024-06-02T10:00:00.000Z',
};

final feedsDashboard = FeedsDashboard.fromJson(dashboardJson);
final minimalFeedsDashboard = FeedsDashboard.fromJson(minimalDashboardJson);
final sourceFeed = SourceFeed.fromJson(sourceFeedJson);
final minimalSourceFeed = SourceFeed.fromJson(minimalSourceFeedJson);
