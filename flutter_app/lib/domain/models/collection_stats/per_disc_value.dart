/// One instance in the per-disc valuation breakdown.
class PerDiscValue {
  const PerDiscValue({
    required this.releaseId,
    required this.instanceId,
    required this.title,
    required this.artist,
    this.mediaCondition,
    this.value,
    required this.reason,
  });

  factory PerDiscValue.fromJson(Map<String, Object?> json) => PerDiscValue(
    releaseId: json['releaseId'] as int,
    instanceId: json['instanceId'] as int,
    title: json['title'] as String,
    artist: json['artist'] as String,
    mediaCondition: json['mediaCondition'] as String?,
    value: (json['value'] as num?)?.toDouble(),
    reason: json['reason'] as String,
  );

  final int releaseId;
  final int instanceId;
  final String title;
  final String artist;
  final String? mediaCondition;

  /// Null when the disc is not covered.
  final double? value;

  /// `ok` | `no_market_data` | `no_condition`.
  final String reason;
}
