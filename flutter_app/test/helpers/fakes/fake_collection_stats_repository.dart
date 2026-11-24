import 'package:vinylmania/data/repositories/collection_stats_repository.dart';
import 'package:vinylmania/domain/models/collection_stats/collection_statistics.dart';
import 'package:vinylmania/domain/models/collection_stats/valuation_chunk.dart';

import '../fixtures/collection_stats_fixtures.dart';

/// Each call is answered by its `onX` handler (defaults: fixtures; the
/// valuation completes in one chunk).
class FakeCollectionStatsRepository implements CollectionStatsRepository {
  Future<CollectionStatistics> Function(bool refresh) onStatistics = (
    _,
  ) async => collectionStatistics;
  Future<ValuationChunk> Function(int cursor, bool refresh, bool retryFailed)
  onValuationChunk = (_, _, _) async => completeValuationChunk;

  @override
  Future<CollectionStatistics> statistics({bool refresh = false}) =>
      onStatistics(refresh);

  @override
  Future<ValuationChunk> valuationChunk({
    int cursor = 0,
    bool refresh = false,
    bool retryFailed = false,
  }) => onValuationChunk(cursor, refresh, retryFailed);
}
