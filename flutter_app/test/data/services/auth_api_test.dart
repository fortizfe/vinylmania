import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:vinylmania/domain/api_exception.dart';
import 'package:vinylmania/data/services/auth_api.dart';

import '../../helpers/mock_api.dart';

import 'package:vinylmania/domain/models/auth/theme_preference.dart';

const _user = {'uid': 'u1', 'displayName': 'Ada', 'email': 'ada@example.com'};

void main() {
  late http.Request captured;

  AuthApi api(int status, Object? body, {String? token}) => AuthApi(
    apiClientWith((request) async {
      captured = request;
      return http.Response(body == null ? '' : jsonEncode(body), status);
    }, token: token),
  );

  test('completeGoogle posts state, code and codeVerifier', () async {
    final result = await api(200, {
      'sessionToken': 'tok',
      'user': _user,
    }).completeGoogle(state: 's', code: 'c', codeVerifier: 'v');

    expect(captured.method, 'POST');
    expect(captured.url.path, '/api/auth/google/complete');
    expect(jsonDecode(captured.body), {
      'state': 's',
      'code': 'c',
      'codeVerifier': 'v',
    });
    expect(result.sessionToken, 'tok');
    expect(result.user.uid, 'u1');
  });

  test('completeGoogle forwards a provider error and backend codes', () async {
    final call = api(400, {
      'error': 'expired_state',
      'message': 'Expired.',
    }).completeGoogle(state: 's', error: 'access_denied', codeVerifier: 'v');

    await expectLater(
      call,
      throwsA(
        isA<ApiException>().having((e) => e.code, 'code', 'expired_state'),
      ),
    );
    expect(jsonDecode(captured.body), {
      'state': 's',
      'error': 'access_denied',
      'codeVerifier': 'v',
    });
  });

  test('me gets the profile with the Bearer token', () async {
    final user = await api(200, _user, token: 'tok').me();

    expect(captured.method, 'GET');
    expect(captured.url.path, '/api/auth/me');
    expect(captured.headers['Authorization'], 'Bearer tok');
    expect(user.email, 'ada@example.com');
  });

  test('deleteSession deletes the session', () async {
    await api(204, null, token: 'tok').deleteSession();

    expect(captured.method, 'DELETE');
    expect(captured.url.path, '/api/auth/session');
  });

  test('setThemePreference patches the preference', () async {
    await api(
      200,
      _user,
      token: 'tok',
    ).setThemePreference(ThemePreference.dark);

    expect(captured.method, 'PATCH');
    expect(captured.url.path, '/api/auth/preferences');
    expect(jsonDecode(captured.body), {'themePreference': 'dark'});
  });
}
