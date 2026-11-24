import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:vinylmania/domain/api_exception.dart';
import 'package:vinylmania/data/services/library_api.dart';
import 'package:vinylmania/domain/models/catalog/catalog_filters.dart';
import 'package:vinylmania/domain/models/library/library_sort.dart';

import '../../helpers/fixtures/library_fixtures.dart';
import '../../helpers/mock_api.dart';

void main() {
  late http.Request request;

  LibraryApi apiReturning(Object? body, {int status = 200}) => LibraryApi(
    apiClientWith((r) async {
      request = r;
      return http.Response(body == null ? '' : jsonEncode(body), status);
    }, token: 't0k'),
  );

  test('list sends paging, sort, dir and filters; maps Paged', () async {
    final api = apiReturning(libraryPageJson);

    final page = await api.list(
      page: 1,
      pageSize: 20,
      sort: LibrarySort.artistAsc,
      filters: const CatalogFilters(style: {'Thrash'}),
    );

    expect(request.method, 'GET');
    expect(request.url.path, '/api/library');
    expect(request.url.queryParameters, {
      'page': '1',
      'pageSize': '20',
      'sort': 'artist',
      'dir': 'asc',
      'style': 'Thrash',
    });
    expect(request.headers['Authorization'], 'Bearer t0k');
    expect(page.items.map((e) => e.id), ['entry-1', 'entry-2']);
    expect(page.page, 1);
    expect(page.hasMore, isTrue); // 1 * 20 < 42
  });

  test('list adds refresh=true and stops at the last page', () async {
    final api = apiReturning({
      'items': <Object?>[],
      'page': 3,
      'pageSize': 20,
      'totalItems': 42,
    });

    final page = await api.list(
      page: 3,
      pageSize: 20,
      sort: LibrarySort.newestFirst,
      refresh: true,
    );

    expect(request.url.queryParameters['refresh'], 'true');
    expect(page.hasMore, isFalse); // 3 * 20 >= 42
    expect(page.totalItems, 42);
  });

  test('get GETs /api/library/:entryId', () async {
    final api = apiReturning(libraryEntryJson);

    final entry = await api.get('entry-1');

    expect(request.url.path, '/api/library/entry-1');
    expect(entry.discogs!.rating, 4);
  });

  test('create POSTs discogsReleaseId', () async {
    final api = apiReturning(libraryEntryJson, status: 201);

    final entry = await api.create(249504);

    expect(request.method, 'POST');
    expect(request.url.path, '/api/library');
    expect(jsonDecode(request.body), {'discogsReleaseId': 249504});
    expect(entry.wantlistRemoval, isNotNull);
  });

  test('update PATCHes only the given field', () async {
    final api = apiReturning(libraryEntryJson);

    await api.update('entry-1', {'mediaCondition': 'Mint (M)'});

    expect(request.method, 'PATCH');
    expect(request.url.path, '/api/library/entry-1');
    expect(jsonDecode(request.body), {'mediaCondition': 'Mint (M)'});
  });

  test('remove DELETEs the entry', () async {
    final api = apiReturning(null, status: 204);

    await api.remove('entry-1');

    expect(request.method, 'DELETE');
    expect(request.url.path, '/api/library/entry-1');
  });

  test('passes discogs_not_linked through as ApiException', () async {
    final api = apiReturning({
      'error': 'discogs_not_linked',
      'message': 'Link Discogs',
    }, status: 409);

    expect(
      api.list(page: 1, pageSize: 20, sort: LibrarySort.newestFirst),
      throwsA(
        isA<ApiException>().having((e) => e.code, 'code', 'discogs_not_linked'),
      ),
    );
  });
}
