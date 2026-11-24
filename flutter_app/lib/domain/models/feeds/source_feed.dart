import 'article.dart';

/// `GET /api/feeds/sources/:sourceId`.
class SourceFeed {
  const SourceFeed({
    required this.sourceId,
    required this.sourceName,
    required this.isAvailable,
    required this.articles,
    required this.generatedAt,
  });

  factory SourceFeed.fromJson(Map<String, Object?> json) => SourceFeed(
    sourceId: json['sourceId'] as String,
    sourceName: json['sourceName'] as String,
    isAvailable: json['status'] == 'ok',
    articles: [
      for (final a in json['articles'] as List)
        Article.fromJson(a as Map<String, Object?>),
    ],
    generatedAt: DateTime.parse(json['generatedAt'] as String),
  );

  final String sourceId;
  final String sourceName;

  /// `status == 'ok'`; false means `unavailable`.
  final bool isAvailable;
  final List<Article> articles;
  final DateTime generatedAt;
}
