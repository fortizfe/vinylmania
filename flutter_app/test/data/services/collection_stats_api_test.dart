import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:vinylmania/domain/api_exception.dart';
import 'package:vinylmania/data/services/collection_stats_api.dart';

import '../../helpers/fixtures/collection_stats_fixtures.dart';
import '../../helpers/mock_api.dart';

void main() {
  late http.Request request;

  CollectionStatsApi apiReturning(Object body, {int status = 200}) =>
      CollectionStatsApi(
        apiClientWith((r) async {
          request = r;
          return http.Response(jsonEncode(body), status);
        }, token: 't0k'),
      );

  test('statistics GETs without query by default', () async {
    final stats = await apiReturning(statisticsJson).statistics();

    expect(request.method, 'GET');
    expect(request.url.path, '/api/collection-stats/statistics');
    expect(request.url.queryParameters, isEmpty);
    expect(request.headers['Authorization'], 'Bearer t0k');
    expect(stats.totalRecords, 39);
  });

  test('statistics sends refresh=true', () async {
    await apiReturning(statisticsJson).statistics(refresh: true);

    expect(request.url.queryParameters, {'refresh': 'true'});
  });

  test('valuationChunk sends cursor only by default', () async {
    final chunk = await apiReturning(partialValuationChunkJson)
        .valuationChunk();

    expect(request.url.path, '/api/collection-stats/valuation');
    expect(request.url.queryParameters, {'cursor': '0'});
    expect(chunk.nextCursor, 25);
  });

  test('valuationChunk sends cursor, refresh and retry=failed', () async {
    await apiReturning(completeValuationChunkJson)
        .valuationChunk(cursor: 25, refresh: true, retryFailed: true);

    expect(request.url.queryParameters, {
      'cursor': '25',
      'refresh': 'true',
      'retry': 'failed',
    });
  });

  test('passes the backend error through as ApiException', () async {
    final api = apiReturning({
      'error': 'discogs_not_linked',
      'message': 'Link',
    }, status: 409);

    expect(api.statistics(), throwsA(isA<ApiException>()));
  });
}
