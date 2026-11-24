import 'collection_valuation.dart';
import 'per_disc_value.dart';

/// One page of the progressive valuation: `GET /api/collection-stats/valuation`.
class ValuationChunk {
  const ValuationChunk({
    required this.valuation,
    required this.status,
    this.nextCursor,
    required this.pricedThisBatch,
    required this.fromCacheThisBatch,
    this.retryable = 0,
    this.perDisc,
  });

  factory ValuationChunk.fromJson(Map<String, Object?> json) => ValuationChunk(
    valuation: CollectionValuation.fromJson(
      json['valuation'] as Map<String, Object?>,
    ),
    status: json['status'] as String,
    nextCursor: json['nextCursor'] as int?,
    pricedThisBatch: json['pricedThisBatch'] as int,
    fromCacheThisBatch: json['fromCacheThisBatch'] as int,
    retryable: json['retryable'] as int? ?? 0,
    perDisc: (json['perDisc'] as List?)
        ?.map((d) => PerDiscValue.fromJson(d as Map<String, Object?>))
        .toList(),
  );

  final CollectionValuation valuation;

  /// `partial` | `complete` | `unavailable`.
  final String status;

  /// Present only while [status] is `partial`.
  final int? nextCursor;
  final int pricedThisBatch;
  final int fromCacheThisBatch;

  /// Discs that failed transiently and can be retried with `retry=failed`.
  final int retryable;

  /// Present only on the final (`complete`) page.
  final List<PerDiscValue>? perDisc;
}
