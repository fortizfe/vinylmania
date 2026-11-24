import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:vinylmania/domain/api_exception.dart';
import 'package:vinylmania/data/services/streaming_api.dart';

import '../../helpers/fixtures/streaming_fixtures.dart';
import '../../helpers/mock_api.dart';

void main() {
  late http.Request request;

  StreamingApi apiReturning(Object body, {int status = 200}) => StreamingApi(
    apiClientWith((r) async {
      request = r;
      return http.Response(jsonEncode(body), status);
    }, token: 't0k'),
  );

  test(
    'links sends artist, title, locale and one barcode param each',
    () async {
      final links = await apiReturning(streamingLinksJson).links(
        barcodes: ['075596043910', '0075596043910'],
        artist: 'Metallica',
        title: 'Master Of Puppets',
        locale: 'es-ES',
      );

      expect(request.method, 'GET');
      expect(request.url.path, '/api/streaming/links');
      expect(request.url.queryParametersAll, {
        'artist': ['Metallica'],
        'title': ['Master Of Puppets'],
        'locale': ['es-ES'],
        'barcode': ['075596043910', '0075596043910'],
      });
      expect(links.single.platform, 'apple_music');
    },
  );

  test('links omits barcode when there is none', () async {
    final links = await apiReturning(emptyStreamingLinksJson)
        .links(barcodes: [], artist: 'A', title: 'T', locale: 'en');

    expect(request.url.queryParametersAll.containsKey('barcode'), isFalse);
    expect(links, isEmpty);
  });

  test('passes the backend error through as ApiException', () async {
    final api = apiReturning({
      'error': 'validation_error',
      'message': 'Bad',
    }, status: 400);

    expect(
      api.links(barcodes: [], artist: '', title: '', locale: 'en'),
      throwsA(isA<ApiException>()),
    );
  });
}
