import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:vinylmania/data/repositories/library_repository.dart';
import 'package:vinylmania/domain/api_exception.dart';
import 'package:vinylmania/data/services/library_api.dart';

import '../../helpers/fixtures/library_fixtures.dart';
import '../../helpers/mock_api.dart';

void main() {
  late List<http.Request> requests;
  late int notifications;

  LibraryRepository repositoryReturning(Object? body, {int status = 200}) {
    requests = [];
    notifications = 0;
    return LibraryRepository(
      api: LibraryApi(
        apiClientWith((r) async {
          requests.add(r);
          return http.Response(body == null ? '' : jsonEncode(body), status);
        }),
      ),
    )..addListener(() => notifications++);
  }

  test('list defaults to page 1 of 20, newest first, no filters', () async {
    final page = await repositoryReturning(libraryPageJson).list();

    expect(requests.single.url.queryParameters, {
      'page': '1',
      'pageSize': '20',
      'sort': 'added',
      'dir': 'desc',
    });
    expect(page.items, hasLength(2));
    expect(notifications, 0);
  });

  test('add notifies listeners after the entry is created', () async {
    final repository = repositoryReturning(libraryEntryJson, status: 201);

    final entry = await repository.add(249504);

    expect(entry.id, 'entry-1');
    expect(notifications, 1);
  });

  test('updateCopy sends exactly the one given field and notifies', () async {
    final repository = repositoryReturning(libraryEntryJson);

    await repository.updateCopy('entry-1', rating: 0);
    await repository.updateCopy('entry-1', notes: '');

    expect(requests.map((r) => jsonDecode(r.body)), [
      {'rating': 0},
      {'notes': ''},
    ]);
    expect(notifications, 2);
  });

  test('updateCopy rejects zero or several fields without a request', () {
    final repository = repositoryReturning(libraryEntryJson);

    expect(() => repository.updateCopy('entry-1'), throwsArgumentError);
    expect(
      () => repository.updateCopy(
        'entry-1',
        rating: 3,
        mediaCondition: 'Mint (M)',
      ),
      throwsArgumentError,
    );
    expect(requests, isEmpty);
  });

  test('remove notifies listeners', () async {
    final repository = repositoryReturning(null, status: 204);

    await repository.remove('entry-1');

    expect(requests.single.method, 'DELETE');
    expect(notifications, 1);
  });

  test('a failed mutation throws and does not notify', () async {
    final repository = repositoryReturning({
      'error': 'entry_not_found',
      'message': 'Gone',
    }, status: 404);

    await expectLater(repository.remove('x'), throwsA(isA<ApiException>()));
    expect(notifications, 0);
  });
}
