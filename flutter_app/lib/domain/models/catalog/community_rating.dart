class CommunityRating {
  const CommunityRating({required this.average, required this.count});

  factory CommunityRating.fromJson(Map<String, Object?> json) =>
      CommunityRating(
        average: (json['average'] as num).toDouble(),
        count: json['count'] as int,
      );

  final double average;
  final int count;
}
