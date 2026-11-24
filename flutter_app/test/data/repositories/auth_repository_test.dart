import 'dart:convert';

import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:vinylmania/data/repositories/auth_repository.dart';
import 'package:vinylmania/data/services/api_client.dart';
import 'package:vinylmania/data/services/auth_api.dart';

import '../../helpers/fakes/fake_oauth_browser.dart';
import '../../helpers/fakes/fake_session_storage.dart';

import 'package:vinylmania/data/repositories/sign_in_outcome.dart';
import 'package:vinylmania/domain/models/auth/theme_preference.dart';

const _user = {
  'uid': 'u1',
  'displayName': 'Ada',
  'email': 'ada@example.com',
  'themePreference': 'dark',
};

http.Response _json(Object body, int status) =>
    http.Response(jsonEncode(body), status);

void main() {
  late FakeSessionStorage storage;
  late FakeOAuthBrowser browser;
  late ApiClient apiClient;
  late List<http.Request> requests;
  late Map<String, http.Response Function()> routes;
  late AuthRepository repo;
  late int notifications;

  setUp(() {
    storage = FakeSessionStorage();
    browser = FakeOAuthBrowser();
    requests = [];
    routes = {};
    apiClient = ApiClient(
      httpClient: MockClient((request) async {
        requests.add(request);
        final route = routes['${request.method} ${request.url.path}'];
        return route == null ? http.Response('', 404) : route();
      }),
      sessionStorage: storage,
      baseUrl: 'http://api.test',
    );
    repo = AuthRepository(
      authApi: AuthApi(apiClient),
      sessionStorage: storage,
      oauthBrowser: browser,
      apiClient: apiClient,
    );
    notifications = 0;
    repo.addListener(() => notifications++);
  });

  group('restore', () {
    test('without a token ends signed out without calling the API', () async {
      expect(repo.isRestoring, isTrue);

      await repo.restore();

      expect(repo.isRestoring, isFalse);
      expect(repo.isSignedIn, isFalse);
      expect(requests, isEmpty);
      expect(notifications, greaterThan(0));
    });

    test('with a token loads the profile and its theme', () async {
      storage.token = 'tok';
      routes['GET /api/auth/me'] = () => _json(_user, 200);

      await repo.restore();

      expect(repo.isRestoring, isFalse);
      expect(repo.user?.uid, 'u1');
      expect(repo.isSignedIn, isTrue);
      expect(repo.themePreference, ThemePreference.dark);
    });

    test('a 401 on me clears the token and stays signed out', () async {
      storage.token = 'stale';
      routes['GET /api/auth/me'] = () =>
          _json({'error': 'unauthorized', 'message': 'No.'}, 401);

      await repo.restore();

      expect(repo.isSignedIn, isFalse);
      expect(repo.isRestoring, isFalse);
      expect(storage.token, isNull);
    });

    test('a storage failure ends restoring signed out', () async {
      storage.readError = PlatformException(code: 'keychain');

      await repo.restore();

      expect(repo.isRestoring, isFalse);
      expect(repo.isSignedIn, isFalse);
      expect(requests, isEmpty);
      expect(notifications, greaterThan(0));
    });
  });

  group('signIn', () {
    test('opens the native authorize URL with a S256 challenge', () async {
      await repo.signIn();

      final url = browser.requested.single;
      expect(url.path, '/api/auth/google/authorize');
      expect(url.queryParameters['client'], 'native');
      expect(
        url.queryParameters['code_challenge'],
        matches(RegExp(r'^[A-Za-z0-9_-]{43}$')),
      );
    });

    test('success stores the session and signs in', () async {
      browser.result = Uri.parse('vinylmania://auth/callback?code=c&state=s');
      routes['POST /api/auth/google/complete'] = () =>
          _json({'sessionToken': 'tok', 'user': _user}, 200);

      final outcome = await repo.signIn();

      expect(outcome, SignInOutcome.success);
      expect(storage.token, 'tok');
      expect(repo.user?.uid, 'u1');
      expect(repo.themePreference, ThemePreference.dark);
      final body = jsonDecode(requests.single.body) as Map;
      expect(body['state'], 's');
      expect(body['code'], 'c');
      expect(body['codeVerifier'], matches(RegExp(r'^[A-Za-z0-9\-._~]{64}$')));
      expect(notifications, greaterThan(0));
    });

    test('a closed browser is cancelled', () async {
      browser.result = null;

      expect(await repo.signIn(), SignInOutcome.cancelled);
      expect(requests, isEmpty);
    });

    test('a provider error is denied', () async {
      browser.result = Uri.parse(
        'vinylmania://auth/callback?error=access_denied&state=s',
      );

      expect(await repo.signIn(), SignInOutcome.denied);
      expect(repo.isSignedIn, isFalse);
    });

    test('expired_state is expired', () async {
      browser.result = Uri.parse('vinylmania://auth/callback?code=c&state=s');
      routes['POST /api/auth/google/complete'] = () =>
          _json({'error': 'expired_state', 'message': 'Expired.'}, 400);

      expect(await repo.signIn(), SignInOutcome.expired);
    });

    test('any other failure is error', () async {
      browser.result = Uri.parse('vinylmania://auth/callback?code=c&state=s');
      routes['POST /api/auth/google/complete'] = () =>
          _json({'error': 'invalid_state', 'message': 'Bad.'}, 400);
      expect(await repo.signIn(), SignInOutcome.error);

      browser.error = PlatformException(code: 'boom');
      expect(await repo.signIn(), SignInOutcome.error);

      browser
        ..error = null
        ..result = Uri.parse('vinylmania://auth/callback?code=c');
      expect(await repo.signIn(), SignInOutcome.error);
    });
  });

  Future<void> signedIn() async {
    storage.token = 'tok';
    routes['GET /api/auth/me'] = () => _json(_user, 200);
    await repo.restore();
    requests.clear();
    notifications = 0;
  }

  test('signOut deletes the session and clears locally', () async {
    await signedIn();
    routes['DELETE /api/auth/session'] = () => http.Response('', 204);

    await repo.signOut();

    expect(requests.single.method, 'DELETE');
    expect(storage.token, isNull);
    expect(repo.isSignedIn, isFalse);
    expect(notifications, greaterThan(0));
  });

  test('signOut clears locally even when the request fails', () async {
    await signedIn();
    routes['DELETE /api/auth/session'] = () =>
        _json({'error': 'internal_error', 'message': 'x'}, 500);

    await repo.signOut();

    expect(storage.token, isNull);
    expect(repo.isSignedIn, isFalse);
  });

  test('an unauthorized response anywhere signs out and notifies', () async {
    await signedIn();

    apiClient.onUnauthorized!();

    expect(repo.isSignedIn, isFalse);
    expect(notifications, 1);
  });

  test('setThemePreference is optimistic and reports success', () async {
    await signedIn();
    routes['PATCH /api/auth/preferences'] = () => _json(_user, 200);

    final saved = repo.setThemePreference(ThemePreference.light);
    expect(repo.themePreference, ThemePreference.light);

    expect(await saved, isTrue);
    expect(jsonDecode(requests.single.body), {'themePreference': 'light'});
  });

  test(
    'setThemePreference keeps the choice but returns false on failure',
    () async {
      await signedIn();
      routes['PATCH /api/auth/preferences'] = () =>
          _json({'error': 'internal_error', 'message': 'x'}, 500);

      expect(await repo.setThemePreference(ThemePreference.light), isFalse);
      expect(repo.themePreference, ThemePreference.light);
    },
  );
}
