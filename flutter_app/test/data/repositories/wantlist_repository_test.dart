import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:vinylmania/data/repositories/wantlist_repository.dart';
import 'package:vinylmania/domain/api_exception.dart';
import 'package:vinylmania/data/services/wantlist_api.dart';

import '../../helpers/fixtures/wantlist_fixtures.dart';
import '../../helpers/mock_api.dart';

void main() {
  late List<http.Request> requests;
  late int notifications;

  WantlistRepository repositoryReturning(Object? body, {int status = 200}) {
    requests = [];
    notifications = 0;
    return WantlistRepository(
      api: WantlistApi(
        apiClientWith((r) async {
          requests.add(r);
          return http.Response(body == null ? '' : jsonEncode(body), status);
        }),
      ),
    )..addListener(() => notifications++);
  }

  test('list defaults to page 1 of 20', () async {
    await repositoryReturning(wantlistPageJson).list();

    expect(requests.single.url.queryParameters, {
      'page': '1',
      'pageSize': '20',
    });
  });

  test('get returns the detail when the release is a want', () async {
    final detail = await repositoryReturning(wantEntryDetailJson).get(249504);

    expect(detail!.rating, 3);
  });

  test('get returns null on 404 (not in wantlist)', () async {
    final repository = repositoryReturning({
      'error': 'not_in_wantlist',
      'message': 'This release is not in your wishlist.',
    }, status: 404);

    expect(await repository.get(1), isNull);
  });

  test('get rethrows any other error', () async {
    final repository = repositoryReturning({
      'error': 'discogs_not_linked',
      'message': 'Link',
    }, status: 409);

    expect(repository.get(1), throwsA(isA<ApiException>()));
  });

  test('add, update and remove notify listeners', () async {
    var repository = repositoryReturning(addToWantlistResultJson, status: 201);
    await repository.add(249504);
    expect(notifications, 1);

    repository = repositoryReturning(wantEntryDetailJson);
    await repository.update(249504, rating: 5);
    expect(jsonDecode(requests.single.body), {'rating': 5});
    expect(notifications, 1);

    repository = repositoryReturning(null, status: 204);
    await repository.remove(249504);
    expect(notifications, 1);
  });
}
