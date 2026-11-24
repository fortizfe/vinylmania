import 'community_rating.dart';

class CommunityStats {
  const CommunityStats({
    required this.have,
    required this.want,
    required this.rating,
  });

  factory CommunityStats.fromJson(Map<String, Object?> json) => CommunityStats(
    have: json['have'] as int,
    want: json['want'] as int,
    rating: CommunityRating.fromJson(json['rating'] as Map<String, Object?>),
  );

  final int have;
  final int want;
  final CommunityRating rating;
}
