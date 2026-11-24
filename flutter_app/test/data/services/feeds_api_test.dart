import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:vinylmania/domain/api_exception.dart';
import 'package:vinylmania/data/services/feeds_api.dart';

import '../../helpers/fixtures/feeds_fixtures.dart';
import '../../helpers/mock_api.dart';

void main() {
  late http.Request request;

  FeedsApi apiReturning(Object body, {int status = 200}) => FeedsApi(
    apiClientWith((r) async {
      request = r;
      return http.Response(jsonEncode(body), status);
    }, token: 't0k'),
  );

  test('dashboard GETs /api/feeds/dashboard', () async {
    final dashboard = await apiReturning(dashboardJson).dashboard();

    expect(request.method, 'GET');
    expect(request.url.path, '/api/feeds/dashboard');
    expect(request.headers['Authorization'], 'Bearer t0k');
    expect(dashboard.categories, hasLength(2));
  });

  test('source GETs /api/feeds/sources/:sourceId', () async {
    final feed = await apiReturning(sourceFeedJson).source('metal-hammer');

    expect(request.url.path, '/api/feeds/sources/metal-hammer');
    expect(feed.sourceName, 'Metal Hammer');
  });

  test('passes the backend error through as ApiException', () async {
    final api = apiReturning({
      'error': 'source_not_found',
      'message': 'Unknown source',
    }, status: 404);

    expect(api.source('nope'), throwsA(isA<ApiException>()));
  });
}
