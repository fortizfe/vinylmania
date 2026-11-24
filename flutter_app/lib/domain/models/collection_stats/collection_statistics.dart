import 'artist_count.dart';
import 'growth_point.dart';
import 'stat_breakdown.dart';

/// `GET /api/collection-stats/statistics`.
class CollectionStatistics {
  const CollectionStatistics({
    required this.totalRecords,
    required this.byDecade,
    required this.byGenre,
    required this.byStyle,
    required this.byLabel,
    required this.topArtists,
    this.mostPresentArtist,
    required this.growth,
  });

  factory CollectionStatistics.fromJson(Map<String, Object?> json) {
    StatBreakdown breakdown(String key) =>
        StatBreakdown.fromJson(json[key] as Map<String, Object?>);
    final growth = json['growth'] as Map<String, Object?>;
    return CollectionStatistics(
      totalRecords: json['totalRecords'] as int,
      byDecade: breakdown('byDecade'),
      byGenre: breakdown('byGenre'),
      byStyle: breakdown('byStyle'),
      byLabel: breakdown('byLabel'),
      topArtists: [
        for (final a in json['topArtists'] as List)
          ArtistCount.fromJson(a as Map<String, Object?>),
      ],
      mostPresentArtist: json['mostPresentArtist'] == null
          ? null
          : ArtistCount.fromJson(
              json['mostPresentArtist'] as Map<String, Object?>,
            ),
      growth: [
        for (final p in growth['points'] as List)
          GrowthPoint.fromJson(p as Map<String, Object?>),
      ],
    );
  }

  final int totalRecords;
  final StatBreakdown byDecade;
  final StatBreakdown byGenre;
  final StatBreakdown byStyle;
  final StatBreakdown byLabel;

  /// Descending, ≤ 10, excludes "Various Artists".
  final List<ArtistCount> topArtists;
  final ArtistCount? mostPresentArtist;

  /// Monthly points, ascending, zero-filled (the wire's `growth.points`).
  final List<GrowthPoint> growth;
}
