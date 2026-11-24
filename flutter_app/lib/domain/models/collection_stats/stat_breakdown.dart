import 'stat_bucket.dart';

/// A ranked facet breakdown: top buckets plus a collapsed `others` remainder.
class StatBreakdown {
  const StatBreakdown({required this.buckets, this.others});

  factory StatBreakdown.fromJson(Map<String, Object?> json) {
    final others = json['others'] as Map<String, Object?>?;
    return StatBreakdown(
      buckets: [
        for (final b in json['buckets'] as List)
          StatBucket.fromJson(b as Map<String, Object?>),
      ],
      others: others == null
          ? null
          : (
              count: others['count'] as int,
              hiddenBuckets: others['hiddenBuckets'] as int,
            ),
    );
  }

  /// Descending by count.
  final List<StatBucket> buckets;

  /// Null when nothing was truncated.
  final ({int count, int hiddenBuckets})? others;
}
