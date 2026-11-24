import 'category_group.dart';
import 'source_status.dart';

/// `GET /api/feeds/dashboard`.
class FeedsDashboard {
  const FeedsDashboard({
    required this.categories,
    required this.sourceStatuses,
    required this.generatedAt,
  });

  factory FeedsDashboard.fromJson(Map<String, Object?> json) => FeedsDashboard(
    categories: [
      for (final c in json['categories'] as List)
        CategoryGroup.fromJson(c as Map<String, Object?>),
    ],
    sourceStatuses: [
      for (final s in json['sourceStatuses'] as List)
        SourceStatus.fromJson(s as Map<String, Object?>),
    ],
    generatedAt: DateTime.parse(json['generatedAt'] as String),
  );

  final List<CategoryGroup> categories;
  final List<SourceStatus> sourceStatuses;
  final DateTime generatedAt;
}
