import 'community_rating.dart';

class CatalogSearchResult {
  const CatalogSearchResult({
    required this.discogsId,
    required this.resultType,
    required this.title,
    this.artist,
    this.thumbnailUrl,
    this.year,
    this.formats = const [],
    this.communityRating,
    this.country,
    this.labels = const [],
  });

  factory CatalogSearchResult.fromJson(Map<String, Object?> json) =>
      CatalogSearchResult(
        discogsId: json['discogsId'] as int,
        resultType: json['resultType'] as String,
        title: json['title'] as String,
        artist: json['artist'] as String?,
        thumbnailUrl: json['thumbnailUrl'] as String?,
        year: json['year'] as int?,
        formats: (json['formats'] as List?)?.cast<String>() ?? const [],
        communityRating: json['communityRating'] == null
            ? null
            : CommunityRating.fromJson(
                json['communityRating'] as Map<String, Object?>,
              ),
        country: json['country'] as String?,
        labels: (json['labels'] as List?)?.cast<String>() ?? const [],
      );

  final int discogsId;

  /// `release` | `artist` | `master`.
  final String resultType;
  final String title;
  final String? artist;
  final String? thumbnailUrl;
  final int? year;
  final List<String> formats;

  /// Present only when Discogs has a valid, votable rating.
  final CommunityRating? communityRating;
  final String? country;
  final List<String> labels;
}
