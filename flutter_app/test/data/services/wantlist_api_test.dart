import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:vinylmania/domain/api_exception.dart';
import 'package:vinylmania/data/services/wantlist_api.dart';

import '../../helpers/fixtures/wantlist_fixtures.dart';
import '../../helpers/mock_api.dart';

void main() {
  late http.Request request;

  WantlistApi apiReturning(Object? body, {int status = 200}) => WantlistApi(
    apiClientWith((r) async {
      request = r;
      return http.Response(body == null ? '' : jsonEncode(body), status);
    }, token: 't0k'),
  );

  test('list sends paging and refresh; maps Paged', () async {
    final api = apiReturning(wantlistPageJson);

    final page = await api.list(page: 2, pageSize: 20, refresh: true);

    expect(request.method, 'GET');
    expect(request.url.path, '/api/wantlist');
    expect(request.url.queryParameters, {
      'page': '2',
      'pageSize': '20',
      'refresh': 'true',
    });
    expect(request.headers['Authorization'], 'Bearer t0k');
    expect(page.items, hasLength(2));
    expect(page.page, 2);
    expect(page.hasMore, isFalse); // 2 * 20 >= 40
    expect(page.totalItems, 40);
  });

  test('get GETs /api/wantlist/:releaseId', () async {
    final api = apiReturning(wantEntryDetailJson);

    final detail = await api.get(249504);

    expect(request.url.path, '/api/wantlist/249504');
    expect(detail.rating, 3);
  });

  test('add POSTs discogsReleaseId', () async {
    final api = apiReturning(addToWantlistResultJson, status: 201);

    final result = await api.add(249504);

    expect(request.method, 'POST');
    expect(request.url.path, '/api/wantlist');
    expect(jsonDecode(request.body), {'discogsReleaseId': 249504});
    expect(result.alreadyInLibrary, isTrue);
  });

  test('update PATCHes only the given fields', () async {
    final api = apiReturning(wantEntryDetailJson);

    await api.update(249504, {'notes': ''});

    expect(request.method, 'PATCH');
    expect(request.url.path, '/api/wantlist/249504');
    expect(jsonDecode(request.body), {'notes': ''});
  });

  test('remove DELETEs the want', () async {
    final api = apiReturning(null, status: 204);

    await api.remove(249504);

    expect(request.method, 'DELETE');
    expect(request.url.path, '/api/wantlist/249504');
  });

  test('passes not_in_wantlist through as ApiException', () async {
    final api = apiReturning({
      'error': 'not_in_wantlist',
      'message': 'This release is not in your wishlist.',
    }, status: 404);

    expect(
      api.get(1),
      throwsA(isA<ApiException>().having((e) => e.statusCode, 'status', 404)),
    );
  });
}
