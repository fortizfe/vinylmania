import 'dart:async';
import 'dart:convert';

import 'package:fake_async/fake_async.dart';
import 'package:flutter/services.dart';

import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:vinylmania/data/services/api_client.dart';
import 'package:vinylmania/domain/api_exception.dart';

import '../../helpers/fakes/fake_session_storage.dart';

http.Response jsonResponse(Object? body, int status) => http.Response(
  jsonEncode(body),
  status,
  headers: {'content-type': 'application/json'},
);

void main() {
  late http.Request captured;

  ApiClient client(
    http.Response Function() respond, {
    String? token,
    FakeSessionStorage? storage,
  }) => ApiClient(
    httpClient: MockClient((request) async {
      captured = request;
      return respond();
    }),
    sessionStorage: storage ?? FakeSessionStorage(token),
    baseUrl: 'http://api.test',
  );

  test('GET prefixes the base URL and decodes the JSON body', () async {
    final api = client(() => jsonResponse({'ok': true}, 200));

    final result = await api.get('/api/auth/me');

    expect(captured.method, 'GET');
    expect(captured.url.toString(), 'http://api.test/api/auth/me');
    expect(result, {'ok': true});
  });

  test('sends a Bearer token only when a session exists', () async {
    final signedIn = client(() => jsonResponse({}, 200), token: 'tok');
    await signedIn.get('/x');
    expect(captured.headers['Authorization'], 'Bearer tok');

    final signedOut = client(() => jsonResponse({}, 200));
    await signedOut.get('/x');
    expect(captured.headers.containsKey('Authorization'), isFalse);
  });

  test('encodes query values, repeating keys for iterables', () async {
    final api = client(() => jsonResponse([], 200));

    await api.get(
      '/api/streaming/links',
      query: {
        'barcode': ['111', '222'],
        'artist': 'AC/DC',
      },
    );

    expect(captured.url.queryParametersAll['barcode'], ['111', '222']);
    expect(captured.url.queryParameters['artist'], 'AC/DC');
  });

  test('POST and PATCH send a JSON body', () async {
    final api = client(() => jsonResponse({'id': 1}, 201));

    final created = await api.post('/api/library', body: {'releaseId': 1});
    expect(captured.method, 'POST');
    expect(captured.headers['Content-Type'], startsWith('application/json'));
    expect(jsonDecode(captured.body), {'releaseId': 1});
    expect(created, {'id': 1});

    await api.patch('/api/auth/preferences', body: {'themePreference': 'dark'});
    expect(captured.method, 'PATCH');
    expect(jsonDecode(captured.body), {'themePreference': 'dark'});
  });

  test('204 returns null and DELETE completes', () async {
    final api = client(() => http.Response('', 204));

    expect(await api.post('/x'), isNull);
    await api.delete('/api/auth/session');
    expect(captured.method, 'DELETE');
  });

  test('non-2xx maps the backend body to ApiException', () async {
    final api = client(
      () => jsonResponse({'error': 'not_found', 'message': 'Gone.'}, 404),
    );

    expect(
      () => api.get('/x'),
      throwsA(
        isA<ApiException>()
            .having((e) => e.statusCode, 'statusCode', 404)
            .having((e) => e.code, 'code', 'not_found')
            .having((e) => e.message, 'message', 'Gone.'),
      ),
    );
  });

  test('a malformed error body maps to unknown', () async {
    final api = client(() => http.Response('<html>oops</html>', 502));

    expect(
      () => api.get('/x'),
      throwsA(
        isA<ApiException>()
            .having((e) => e.statusCode, 'statusCode', 502)
            .having((e) => e.code, 'code', 'unknown')
            .having((e) => e.message, 'message', 'Request failed'),
      ),
    );
  });

  test('a client/socket error maps to network_error with status 0', () async {
    final api = ApiClient(
      httpClient: MockClient((_) => throw http.ClientException('offline')),
      sessionStorage: FakeSessionStorage(),
      baseUrl: 'http://api.test',
    );

    expect(
      () => api.get('/x'),
      throwsA(
        isA<ApiException>()
            .having((e) => e.statusCode, 'statusCode', 0)
            .having((e) => e.code, 'code', 'network_error'),
      ),
    );
  });

  test('401 clears the session and calls onUnauthorized', () async {
    final storage = FakeSessionStorage('tok');
    final api = client(
      () => jsonResponse({'error': 'unauthorized', 'message': 'No.'}, 401),
      storage: storage,
    );
    var calls = 0;
    api.onUnauthorized = () => calls++;

    await expectLater(api.get('/x'), throwsA(isA<ApiException>()));

    expect(calls, 1);
    expect(storage.token, isNull);
  });

  test('401 discogs_link_invalid keeps the session', () async {
    final storage = FakeSessionStorage('tok');
    final api = client(
      () => jsonResponse({
        'error': 'discogs_link_invalid',
        'message': 'Relink.',
      }, 401),
      storage: storage,
    );
    var calls = 0;
    api.onUnauthorized = () => calls++;

    await expectLater(
      api.get('/x'),
      throwsA(
        isA<ApiException>().having(
          (e) => e.code,
          'code',
          'discogs_link_invalid',
        ),
      ),
    );

    expect(calls, 0);
    expect(storage.token, 'tok');
  });

  test('a storage failure maps to network_error with status 0', () async {
    var sent = false;
    final api = ApiClient(
      httpClient: MockClient((_) async {
        sent = true;
        return jsonResponse({}, 200);
      }),
      sessionStorage: FakeSessionStorage()
        ..readError = PlatformException(code: 'keychain'),
      baseUrl: 'http://api.test',
    );

    await expectLater(
      api.get('/x'),
      throwsA(
        isA<ApiException>()
            .having((e) => e.statusCode, 'statusCode', 0)
            .having((e) => e.code, 'code', 'network_error'),
      ),
    );
    expect(sent, isFalse);
  });

  test('a request that never answers times out as network_error', () {
    fakeAsync((async) {
      final api = ApiClient(
        httpClient: MockClient((_) => Completer<http.Response>().future),
        sessionStorage: FakeSessionStorage(),
        baseUrl: 'http://api.test',
      );
      Object? error;
      api.get('/x').catchError((Object e) {
        error = e;
        return null;
      });

      async.elapse(const Duration(seconds: 29));
      expect(error, isNull);
      async.elapse(const Duration(seconds: 2));

      expect(
        error,
        isA<ApiException>()
            .having((e) => e.statusCode, 'statusCode', 0)
            .having((e) => e.code, 'code', 'network_error'),
      );
    });
  });
}
