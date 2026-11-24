import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:vinylmania/domain/api_exception.dart';
import 'package:vinylmania/data/services/discogs_catalog_api.dart';
import 'package:vinylmania/domain/models/catalog/catalog_filters.dart';

import '../../helpers/fixtures/catalog_fixtures.dart';
import '../../helpers/mock_api.dart';

void main() {
  late http.Request request;

  DiscogsCatalogApi apiReturning(Object body, {int status = 200}) =>
      DiscogsCatalogApi(
        apiClientWith((r) async {
          request = r;
          return http.Response(jsonEncode(body), status);
        }, token: 't0k'),
      );

  test('suggest GETs /api/discogs/suggest and unwraps suggestions', () async {
    final api = apiReturning({
      'suggestions': [suggestionJson, minimalSuggestionJson],
    });

    final suggestions = await api.suggest('metal');

    expect(request.method, 'GET');
    expect(request.url.path, '/api/discogs/suggest');
    expect(request.url.queryParameters, {'q': 'metal'});
    expect(request.headers['Authorization'], 'Bearer t0k');
    expect(suggestions.map((s) => s.discogsId), [6513, 18839]);
  });

  test('search sends type=release, page, perPage and filters', () async {
    final api = apiReturning(searchResponseJson);

    final page = await api.search(
      'puppets',
      page: 1,
      perPage: 20,
      filters: const CatalogFilters(genre: {'Rock'}, format: {'Vinyl'}),
    );

    expect(request.url.path, '/api/discogs/search');
    expect(request.url.queryParameters, {
      'q': 'puppets',
      'type': 'release',
      'page': '1',
      'perPage': '20',
      'genre': 'Rock',
      'format': 'Vinyl',
    });
    expect(page.items.map((r) => r.discogsId), [249504, 2]);
    expect(page.page, 1);
    expect(page.hasMore, isTrue);
  });

  test('search reports no more pages on the last page', () async {
    final api = apiReturning({
      'results': <Object?>[],
      'pagination': {'page': 3, 'pages': 3, 'items': 42, 'perPage': 20},
    });

    final page = await api.search('x', page: 3, perPage: 20);

    expect(page.hasMore, isFalse);
  });

  test('getRelease GETs /api/discogs/releases/:id', () async {
    final api = apiReturning(releaseJson);

    final r = await api.getRelease(249504);

    expect(request.method, 'GET');
    expect(request.url.path, '/api/discogs/releases/249504');
    expect(r.title, 'Master Of Puppets');
  });

  test('getMaster GETs /api/discogs/masters/:id', () async {
    final api = apiReturning(masterJson);

    final m = await api.getMaster(6513);

    expect(request.url.path, '/api/discogs/masters/6513');
    expect(m.mainReleaseId, 249504);
  });

  test('getMasterVersions sends page and maps pagination', () async {
    final api = apiReturning(masterVersionsResponseJson);

    final page = await api.getMasterVersions(6513, page: 2);

    expect(request.url.path, '/api/discogs/masters/6513/versions');
    expect(request.url.queryParameters, {'page': '2'});
    expect(page.items, hasLength(2));
    expect(page.page, 2);
    expect(page.hasMore, isFalse);
  });

  test('passes the backend error through as ApiException', () async {
    final api = apiReturning({
      'error': 'release_not_found',
      'message': 'Not found',
    }, status: 404);

    expect(
      api.getRelease(1),
      throwsA(
        isA<ApiException>()
            .having((e) => e.statusCode, 'statusCode', 404)
            .having((e) => e.code, 'code', 'release_not_found'),
      ),
    );
  });
}
