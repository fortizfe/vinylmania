import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:vinylmania/domain/api_exception.dart';
import 'package:vinylmania/data/services/discogs_oauth_api.dart';

import '../../helpers/fixtures/discogs_fixtures.dart';
import '../../helpers/mock_api.dart';

void main() {
  late http.Request request;

  DiscogsOauthApi apiReturning(Object? body, {int status = 200}) =>
      DiscogsOauthApi(
        apiClientWith((r) async {
          request = r;
          return http.Response(body == null ? '' : jsonEncode(body), status);
        }, token: 't0k'),
      );

  test('status GETs /api/discogs/oauth/status', () async {
    final status = await apiReturning(connectedStatusJson).status();

    expect(request.method, 'GET');
    expect(request.url.path, '/api/discogs/oauth/status');
    expect(request.headers['Authorization'], 'Bearer t0k');
    expect(status.discogsUsername, 'vinyl_fan');
  });

  test('request POSTs client native and returns the authorize URL', () async {
    final url = await apiReturning({
      'authorizeUrl': 'https://discogs.com/oauth/authorize?oauth_token=abc',
    }).request();

    expect(request.method, 'POST');
    expect(request.url.path, '/api/discogs/oauth/request');
    expect(jsonDecode(request.body), {'client': 'native'});
    expect(
      url,
      Uri.parse('https://discogs.com/oauth/authorize?oauth_token=abc'),
    );
  });

  test('complete POSTs oauthToken and oauthVerifier', () async {
    final status = await apiReturning(connectedStatusJson)
        .complete(oauthToken: 'tok', oauthVerifier: 'ver');

    expect(request.method, 'POST');
    expect(request.url.path, '/api/discogs/oauth/complete');
    expect(jsonDecode(request.body), {
      'oauthToken': 'tok',
      'oauthVerifier': 'ver',
    });
    expect(status.connected, isTrue);
  });

  test('disconnect DELETEs the connection', () async {
    await apiReturning(null, status: 204).disconnect();

    expect(request.method, 'DELETE');
    expect(request.url.path, '/api/discogs/oauth/connection');
  });

  test('passes expired_request through as ApiException', () async {
    final api = apiReturning({
      'error': 'expired_request',
      'message': 'Expired',
    }, status: 400);

    expect(
      api.complete(oauthToken: 'a', oauthVerifier: 'b'),
      throwsA(
        isA<ApiException>().having((e) => e.code, 'code', 'expired_request'),
      ),
    );
  });
}
