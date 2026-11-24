import 'dart:async';

import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:material_ui/material_ui.dart';
import 'package:provider/provider.dart';
import 'package:vinylmania/app/app.dart';
import 'package:vinylmania/app/dependencies.dart';
import 'package:vinylmania/data/repositories/auth_repository.dart';
import 'package:vinylmania/ui/auth/widgets/sign_in_screen.dart';
import 'package:vinylmania/ui/auth/widgets/splash_screen.dart';

import '../helpers/fakes/fake_auth_repository.dart';
import '../helpers/fakes/fake_oauth_browser.dart';
import '../helpers/fakes/fake_session_storage.dart';

import 'package:vinylmania/domain/models/auth/theme_preference.dart';

void main() {
  testWidgets('boots to splash, restores, then shows sign-in', (tester) async {
    final restore = Completer<void>();
    final auth = FakeAuthRepository(isRestoring: true)
      ..pendingRestore = restore;
    await tester.pumpWidget(
      ChangeNotifierProvider<AuthRepository>.value(
        value: auth,
        child: const App(),
      ),
    );
    await tester.pump();

    expect(find.byType(SplashScreen), findsOneWidget);
    expect(auth.restoreCalls, 1);

    restore.complete();
    await tester.pump();
    await tester.pump();
    expect(find.byType(SignInScreen), findsOneWidget);
  });

  ThemeMode themeMode(WidgetTester tester) =>
      tester.widget<MaterialApp>(find.byType(MaterialApp)).themeMode!;

  testWidgets('themeMode follows the saved preference', (tester) async {
    final auth = FakeAuthRepository();
    await tester.pumpWidget(
      ChangeNotifierProvider<AuthRepository>.value(
        value: auth,
        child: const App(),
      ),
    );
    await tester.pump();
    expect(themeMode(tester), ThemeMode.system);

    await auth.setThemePreference(ThemePreference.dark);
    await tester.pump();
    expect(themeMode(tester), ThemeMode.dark);

    await auth.setThemePreference(ThemePreference.light);
    await tester.pump();
    expect(themeMode(tester), ThemeMode.light);
  });

  testWidgets('real providers wire up and restore without a token', (
    tester,
  ) async {
    final requests = <http.BaseRequest>[];
    await tester.pumpWidget(
      MultiProvider(
        providers: buildProviders(
          httpClient: MockClient((r) async {
            requests.add(r);
            return http.Response('', 401);
          }),
          sessionStorage: FakeSessionStorage(),
          oauthBrowser: FakeOAuthBrowser(),
        ),
        child: const App(),
      ),
    );
    await tester.pump();
    await tester.pump();

    expect(find.byType(SignInScreen), findsOneWidget);
    expect(requests, isEmpty);
  });
}
