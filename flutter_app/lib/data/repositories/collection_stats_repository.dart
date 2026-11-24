import '../../domain/models/collection_stats/collection_statistics.dart';
import '../../domain/models/collection_stats/valuation_chunk.dart';
import '../services/collection_stats_api.dart';

/// Collection statistics and the progressive valuation. Throws `ApiException`.
class CollectionStatsRepository {
  CollectionStatsRepository({required this._api});

  final CollectionStatsApi _api;

  Future<CollectionStatistics> statistics({bool refresh = false}) =>
      _api.statistics(refresh: refresh);

  /// One chunk; loop with `nextCursor` until `status != 'partial'`.
  /// [retryFailed] re-prices only the discs that failed transiently.
  Future<ValuationChunk> valuationChunk({
    int cursor = 0,
    bool refresh = false,
    bool retryFailed = false,
  }) => _api.valuationChunk(
    cursor: cursor,
    refresh: refresh,
    retryFailed: retryFailed,
  );
}
