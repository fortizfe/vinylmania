import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:vinylmania/data/repositories/catalog_repository.dart';
import 'package:vinylmania/data/services/discogs_catalog_api.dart';

import '../../helpers/fixtures/catalog_fixtures.dart';
import '../../helpers/mock_api.dart';

void main() {
  final requests = <http.Request>[];

  CatalogRepository repositoryReturning(Object body) {
    requests.clear();
    return CatalogRepository(
      api: DiscogsCatalogApi(
        apiClientWith((r) async {
          requests.add(r);
          return http.Response(jsonEncode(body), 200);
        }),
      ),
    );
  }

  test('search defaults to page 1, 20 per page, releases only', () async {
    final page = await repositoryReturning(searchResponseJson).search('metal');

    expect(requests.single.url.queryParameters, {
      'q': 'metal',
      'type': 'release',
      'page': '1',
      'perPage': '20',
    });
    expect(page.hasMore, isTrue);
  });

  test('getMasterVersions defaults to page 1', () async {
    await repositoryReturning(masterVersionsResponseJson)
        .getMasterVersions(6513);

    expect(requests.single.url.queryParameters, {'page': '1'});
  });
}
