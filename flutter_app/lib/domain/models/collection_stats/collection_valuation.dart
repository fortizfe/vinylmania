import 'per_disc_value.dart';

/// Running valuation totals, one snapshot per chunk.
class CollectionValuation {
  const CollectionValuation({
    this.currency,
    required this.estimatedTotal,
    required this.coveredCount,
    required this.totalCount,
    required this.uncovered,
    required this.topValuable,
    required this.status,
  });

  factory CollectionValuation.fromJson(Map<String, Object?> json) {
    final uncovered = json['uncovered'] as Map<String, Object?>;
    return CollectionValuation(
      currency: json['currency'] as String?,
      estimatedTotal: (json['estimatedTotal'] as num).toDouble(),
      coveredCount: json['coveredCount'] as int,
      totalCount: json['totalCount'] as int,
      uncovered: (
        noMarketData: uncovered['noMarketData'] as int,
        noCondition: uncovered['noCondition'] as int,
      ),
      topValuable: [
        for (final d in json['topValuable'] as List)
          PerDiscValue.fromJson(d as Map<String, Object?>),
      ],
      status: json['status'] as String,
    );
  }

  /// e.g. `EUR`; null until the first priced disc.
  final String? currency;
  final double estimatedTotal;
  final int coveredCount;
  final int totalCount;
  final ({int noMarketData, int noCondition}) uncovered;

  /// Descending by value, ≤ 10.
  final List<PerDiscValue> topValuable;

  /// `partial` | `complete` | `unavailable`.
  final String status;
}
