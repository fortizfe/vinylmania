/// One month on the growth timeline.
class GrowthPoint {
  const GrowthPoint({
    required this.period,
    required this.added,
    required this.cumulative,
  });

  factory GrowthPoint.fromJson(Map<String, Object?> json) => GrowthPoint(
    period: json['period'] as String,
    added: json['added'] as int,
    cumulative: json['cumulative'] as int,
  );

  /// `YYYY-MM`.
  final String period;
  final int added;

  /// Running total up to and including this period.
  final int cumulative;
}
