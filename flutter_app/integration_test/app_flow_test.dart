import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:integration_test/integration_test.dart';
import 'package:material_ui/material_ui.dart';
import 'package:provider/provider.dart';
import 'package:vinylmania/app/app.dart';
import 'package:vinylmania/app/dependencies.dart';
import 'package:vinylmania/ui/auth/widgets/sign_in_screen.dart';

import '../test/helpers/fakes/fake_oauth_browser.dart';
import '../test/helpers/fakes/fake_session_storage.dart';
import '../test/helpers/fixtures/catalog_fixtures.dart';
import '../test/helpers/fixtures/discogs_fixtures.dart';
import '../test/helpers/fixtures/feeds_fixtures.dart';
import '../test/helpers/fixtures/library_fixtures.dart';
import '../test/helpers/pump_screen.dart';

/// Q1: the whole signed-in journey against the real providers, with the
/// backend faked by a [MockClient] and the system auth sheet by
/// [FakeOAuthBrowser]. No network, no keychain. Images are stripped from the
/// fixtures so nothing touches the network on a device either.
///
/// Run: `flutter test integration_test/app_flow_test.dart -d macos`
/// (or any device). The real Google sign-in round-trip stays manual
/// (quickstart): it needs the deployed backend and the registered redirect.
void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  for (final (name, size) in [
    ('compact', compactSize),
    ('expanded', expandedSize),
  ]) {
    testWidgets('sign-in → news → search → release → library → rate → '
        'profile → sign out ($name)', (tester) async {
      tester.view
        ..physicalSize = size
        ..devicePixelRatio = 1;
      addTearDown(tester.view.reset);

      final backend = _FakeBackend();
      final storage = FakeSessionStorage();
      await tester.pumpWidget(
        MultiProvider(
          providers: buildProviders(
            httpClient: MockClient(backend.handle),
            sessionStorage: storage,
            oauthBrowser: FakeOAuthBrowser(
              result: Uri.parse('vinylmania://auth?state=st&code=co'),
            ),
          ),
          child: const App(),
        ),
      );

      Future<void> tapNav(String label) async {
        // Compact: bottom bar + avatar (semantics); expanded: rail labels.
        await tester.tap(
          size == compactSize ? find.bySemanticsLabel(label) : find.text(label),
        );
        await tester.pump();
      }

      // Sign in.
      await _pumpUntilFound(tester, find.text('Continue with Google'));
      await tester.tap(find.text('Continue with Google'));
      await _pumpUntilFound(tester, find.text('Metallica announce reissue'));
      expect(storage.token, 'session-token');
      expect(backend.bodyOf('POST', '/api/auth/google/complete'), {
        'state': 'st',
        'code': 'co',
        'codeVerifier': isA<String>(),
      });

      // Search and open the release.
      await tapNav('Search');
      await _pumpUntilFound(tester, find.byType(TextField));
      await tester.enterText(find.byType(TextField), 'metallica');
      await tester.testTextInput.receiveAction(TextInputAction.search);
      await _pumpUntilFound(tester, find.text('Master Of Puppets'));
      await tester.tap(find.text('Master Of Puppets').first);
      await _pumpUntilFound(tester, find.text('Tracklist'));

      // Add to library.
      await tester.ensureVisible(find.text('Add to library'));
      await tester.tap(find.text('Add to library'));
      await _pumpUntilFound(tester, find.text('Added to library'));
      expect(backend.bodyOf('POST', '/api/library'), {
        'discogsReleaseId': 249504,
      });

      // Library → record detail → rate.
      await tapNav('Library');
      await _pumpUntilFound(tester, find.text('1 record'));
      await _pumpUntilGone(tester, find.text('Tracklist'));
      await tester.tap(find.text('Master Of Puppets'));
      await _pumpUntilFound(tester, find.text('Your copy'));
      await tester.ensureVisible(find.byKey(const ValueKey('star-5')));
      await tester.tap(find.byKey(const ValueKey('star-5')));
      await _pumpUntil(
        tester,
        () => backend.bodyOf('PATCH', '/api/library/entry-1') != null,
      );
      expect(backend.bodyOf('PATCH', '/api/library/entry-1'), {'rating': 5});

      // Profile → sign out.
      await tapNav('Profile');
      await _pumpUntilFound(tester, find.text('vinyl_fan'));
      await tester.ensureVisible(find.text('Sign out'));
      await tester.tap(find.text('Sign out'));
      await _pumpUntilFound(tester, find.byType(SignInScreen));
      expect(backend.calls, contains('DELETE /api/auth/session'));
      expect(storage.token, isNull);
    });
  }
}

/// Pumps 100 ms frames until [done] (5 s cap). Skeletons pulse forever, so
/// `pumpAndSettle` can't be used while one is on screen.
Future<void> _pumpUntil(WidgetTester tester, bool Function() done) async {
  for (var i = 0; i < 50 && !done(); i++) {
    await tester.pump(const Duration(milliseconds: 100));
  }
}

Future<void> _pumpUntilFound(WidgetTester tester, Finder finder) async {
  await _pumpUntil(tester, () => finder.evaluate().isNotEmpty);
  expect(finder, findsWidgets);
}

/// E.g. until a route transition has ended.
Future<void> _pumpUntilGone(WidgetTester tester, Finder finder) async {
  await _pumpUntil(tester, () => finder.evaluate().isEmpty);
  expect(finder, findsNothing);
}

/// The backend the journey needs, recording every call.
class _FakeBackend {
  final calls = <String>[];
  final _bodies = <String, Object?>{};

  static final _release = {...releaseJson, 'images': <Object?>[]};
  static final _result = {...searchResultJson}..remove('thumbnailUrl');
  static final _article = {...articleJson}..remove('imageUrl');
  static final _entry = {...libraryEntryJson, 'release': _release};

  Object? bodyOf(String method, String path) => _bodies['$method $path'];

  Future<http.Response> handle(http.Request r) async {
    final key = '${r.method} ${r.url.path}';
    calls.add(key);
    if (r.body.isNotEmpty) _bodies[key] = jsonDecode(r.body);
    final Object? body = switch (key) {
      'POST /api/auth/google/complete' => {
        'sessionToken': 'session-token',
        'user': {
          'uid': 'u1',
          'displayName': 'Vinyl Fan',
          'email': 'fan@example.com',
        },
      },
      'GET /api/feeds/dashboard' => {
        'categories': [
          {
            'category': 'Metal',
            'articles': [_article],
          },
        ],
        'sourceStatuses': dashboardJson['sourceStatuses'],
        'generatedAt': dashboardJson['generatedAt'],
      },
      'GET /api/discogs/suggest' => {'suggestions': <Object?>[]},
      'GET /api/discogs/search' => {
        'results': [_result],
        'pagination': {'page': 1, 'pages': 1, 'items': 1, 'perPage': 20},
      },
      'GET /api/discogs/releases/249504' => _release,
      'GET /api/streaming/links' => {'links': <Object?>[]},
      'POST /api/library' || 'GET /api/library/entry-1' => _entry,
      'GET /api/library' => {
        'items': [_entry],
        'page': 1,
        'pageSize': 20,
        'totalItems': 1,
      },
      'PATCH /api/library/entry-1' => {
        ..._entry,
        'discogs': {...copyDataJson, 'rating': 5},
      },
      'GET /api/discogs/oauth/status' => connectedStatusJson,
      'DELETE /api/auth/session' => null,
      _ => _notFound,
    };
    if (identical(body, _notFound)) {
      return http.Response(
        jsonEncode({'error': 'not_found', 'message': 'Not found'}),
        404,
      );
    }
    return body == null
        ? http.Response('', 204)
        : http.Response(
            jsonEncode(body),
            200,
            headers: {'content-type': 'application/json'},
          );
  }

  static const _notFound = Object();
}
