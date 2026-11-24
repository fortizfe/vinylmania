import '../../domain/models/collection_stats/collection_statistics.dart';
import '../../domain/models/collection_stats/valuation_chunk.dart';
import 'api_client.dart';

/// `/api/collection-stats/*` calls.
class CollectionStatsApi {
  CollectionStatsApi(this._client);

  final ApiClient _client;

  Future<CollectionStatistics> statistics({bool refresh = false}) async =>
      CollectionStatistics.fromJson(
        await _client.get(
          '/api/collection-stats/statistics',
          query: {if (refresh) 'refresh': 'true'},
        ) as Map<String, Object?>,
      );

  /// `refresh` is honoured by the backend on cursor 0 only.
  Future<ValuationChunk> valuationChunk({
    int cursor = 0,
    bool refresh = false,
    bool retryFailed = false,
  }) async => ValuationChunk.fromJson(
    await _client.get(
      '/api/collection-stats/valuation',
      query: {
        'cursor': '$cursor',
        if (refresh) 'refresh': 'true',
        if (retryFailed) 'retry': 'failed',
      },
    ) as Map<String, Object?>,
  );
}
