import 'package:vinylmania/domain/models/collection_stats/collection_statistics.dart';
import 'package:vinylmania/domain/models/collection_stats/valuation_chunk.dart';

/// Wire shapes of `/api/collection-stats/*`
/// (frontend/src/services/collectionStatsApi.ts).

const _breakdownJson = <String, Object?>{
  'buckets': [
    {'label': 'Rock', 'count': 30},
    {'label': 'Electronic', 'count': 5},
  ],
  'others': {'count': 4, 'hiddenBuckets': 2},
};

const _emptyBreakdownJson = <String, Object?>{
  'buckets': <Object?>[],
  'others': null,
};

const statisticsJson = <String, Object?>{
  'totalRecords': 39,
  'byDecade': _breakdownJson,
  'byGenre': _breakdownJson,
  'byStyle': _breakdownJson,
  'byLabel': _breakdownJson,
  'topArtists': [
    {'name': 'Metallica', 'count': 6},
    {'name': 'Slayer', 'count': 3},
  ],
  'mostPresentArtist': {'name': 'Metallica', 'count': 6},
  'growth': {
    'granularity': 'month',
    'points': [
      {'period': '2024-04', 'added': 2, 'cumulative': 37},
      {'period': '2024-05', 'added': 2, 'cumulative': 39},
    ],
  },
};

const minimalStatisticsJson = <String, Object?>{
  'totalRecords': 0,
  'byDecade': _emptyBreakdownJson,
  'byGenre': _emptyBreakdownJson,
  'byStyle': _emptyBreakdownJson,
  'byLabel': _emptyBreakdownJson,
  'topArtists': <Object?>[],
  'mostPresentArtist': null,
  'growth': {'granularity': 'month', 'points': <Object?>[]},
};

const perDiscValueJson = <String, Object?>{
  'releaseId': 249504,
  'instanceId': 900,
  'title': 'Master Of Puppets',
  'artist': 'Metallica',
  'mediaCondition': 'Near Mint (NM or M-)',
  'value': 45.5,
  'reason': 'ok',
};

const uncoveredDiscJson = <String, Object?>{
  'releaseId': 1,
  'instanceId': 901,
  'title': 'Untitled',
  'artist': 'Unknown',
  'mediaCondition': null,
  'value': null,
  'reason': 'no_condition',
};

const _valuationJson = <String, Object?>{
  'currency': 'EUR',
  'estimatedTotal': 120,
  'coveredCount': 3,
  'totalCount': 5,
  'uncovered': {'noMarketData': 1, 'noCondition': 1},
  'topValuable': [perDiscValueJson],
  'status': 'complete',
};

const completeValuationChunkJson = <String, Object?>{
  'valuation': _valuationJson,
  'status': 'complete',
  'pricedThisBatch': 2,
  'fromCacheThisBatch': 1,
  'retryable': 1,
  'perDisc': [perDiscValueJson, uncoveredDiscJson],
};

const partialValuationChunkJson = <String, Object?>{
  'valuation': {
    'currency': null,
    'estimatedTotal': 0,
    'coveredCount': 0,
    'totalCount': 5,
    'uncovered': {'noMarketData': 0, 'noCondition': 0},
    'topValuable': <Object?>[],
    'status': 'partial',
  },
  'status': 'partial',
  'nextCursor': 25,
  'pricedThisBatch': 0,
  'fromCacheThisBatch': 0,
};

final collectionStatistics = CollectionStatistics.fromJson(statisticsJson);
final minimalCollectionStatistics = CollectionStatistics.fromJson(
  minimalStatisticsJson,
);
final completeValuationChunk = ValuationChunk.fromJson(
  completeValuationChunkJson,
);
final partialValuationChunk = ValuationChunk.fromJson(
  partialValuationChunkJson,
);
