import 'dart:async';

import 'package:flutter_test/flutter_test.dart';
import 'package:material_ui/material_ui.dart';
import 'package:vinylmania/domain/api_exception.dart';
import 'package:vinylmania/domain/models/discogs/discogs_connection_status.dart';
import 'package:vinylmania/ui/core/widgets/skeleton.dart';
import 'package:vinylmania/ui/profile/view_models/profile_view_model.dart';
import 'package:vinylmania/ui/profile/widgets/discogs_connection_card_skeleton.dart';
import 'package:vinylmania/ui/profile/widgets/profile_compact_layout.dart';
import 'package:vinylmania/ui/profile/widgets/profile_expanded_layout.dart';
import 'package:vinylmania/ui/profile/widgets/profile_screen.dart';

import '../../../helpers/fakes/fake_auth_repository.dart';
import '../../../helpers/fakes/fake_discogs_connection_repository.dart';
import '../../../helpers/fixtures/discogs_fixtures.dart';
import '../../../helpers/pump_screen.dart';

import 'package:vinylmania/domain/models/auth/theme_preference.dart';
import 'package:vinylmania/domain/models/discogs/discogs_link_outcome.dart';

void main() {
  late FakeAuthRepository auth;
  late FakeDiscogsConnectionRepository discogs;

  setUp(() {
    auth = FakeAuthRepository(user: testUser);
    discogs = FakeDiscogsConnectionRepository();
  });

  Future<void> pump(
    WidgetTester tester, {
    Size size = compactSize,
    ThemeMode mode = ThemeMode.light,
    double textScale = 1,
  }) async {
    await pumpScreen(
      tester,
      ProfileScreen(
        createViewModel: () => ProfileViewModel(
          authRepository: auth,
          discogsConnectionRepository: discogs,
        ),
      ),
      size: size,
      mode: mode,
      textScale: textScale,
    );
    await tester.pump();
  }

  Future<void> tapText(WidgetTester tester, String text) async {
    await tester.ensureVisible(find.text(text));
    await tester.tap(find.text(text));
    await tester.pump();
    await tester.pump();
  }

  for (final (size, layout) in [
    (compactSize, ProfileCompactLayout),
    (expandedSize, ProfileExpandedLayout),
  ]) {
    for (final mode in [ThemeMode.light, ThemeMode.dark]) {
      testWidgets('$layout: preferences, Discogs and sign out ($mode)', (
        tester,
      ) async {
        await pump(tester, size: size, mode: mode);

        expect(find.byType(layout), findsOneWidget);
        expect(find.text('Profile'), findsOneWidget);
        expect(find.text('Preferences'), findsOneWidget);
        expect(find.text('Dark mode'), findsOneWidget);
        expect(find.text('Connected services'), findsOneWidget);
        expect(find.text('Discogs'), findsOneWidget);
        expect(find.text('Connected'), findsOneWidget);
        expect(find.text('vinyl_fan'), findsOneWidget);
        expect(find.textContaining('Linked on'), findsOneWidget);
        expect(find.text('Disconnect'), findsOneWidget);
        expect(find.text('Sign out'), findsOneWidget);
        await expectA11yGuidelines(tester);
      });
    }

    testWidgets('$layout: no overflow at text scale 2.0', (tester) async {
      await pump(tester, size: size, textScale: 2);
      expect(tester.takeException(), isNull);
    });

    testWidgets('$layout: card skeleton keeps the card size', (tester) async {
      final pending = Completer<DiscogsConnectionStatus>();
      discogs.onStatus = () => pending.future;
      await pump(tester, size: size);

      expect(find.byType(DiscogsConnectionCardSkeleton), findsOneWidget);
      expect(find.byType(Skeleton), findsWidgets);
      final before = tester.getSize(find.byType(DiscogsConnectionCardSkeleton));
      expect(before.height, greaterThanOrEqualTo(144));

      pending.complete(disconnectedStatus);
      await tester.pump(const Duration(seconds: 1));
      expect(find.text('Connect Discogs account'), findsOneWidget);
    });
  }

  testWidgets('not connected: link → outcome banner, dismissible', (
    tester,
  ) async {
    discogs.onStatus = () async => disconnectedStatus;
    discogs.onLink = () async {
      discogs.onStatus = () async => connectedStatus;
      return DiscogsLinkOutcome.linked;
    };
    await pump(tester);
    expect(
      find.text(
        'Not connected. Link your Discogs account to prepare for collection '
        'syncing.',
      ),
      findsOneWidget,
    );

    await tapText(tester, 'Connect Discogs account');

    expect(find.text('Discogs account linked.'), findsOneWidget);
    expect(find.text('vinyl_fan'), findsOneWidget);
    await tester.tap(find.bySemanticsLabel('Dismiss'));
    await tester.pump();
    expect(find.text('Discogs account linked.'), findsNothing);
  });

  testWidgets('denied link shows the warning text', (tester) async {
    discogs.onStatus = () async => disconnectedStatus;
    discogs.onLink = () async => DiscogsLinkOutcome.denied;
    await pump(tester);
    await tapText(tester, 'Connect Discogs account');
    expect(
      find.text(
        'The Discogs connection was not completed. You can try again '
        'whenever you like.',
      ),
      findsOneWidget,
    );
  });

  testWidgets('disconnect asks inline, keep connection cancels', (
    tester,
  ) async {
    await pump(tester);
    await tapText(tester, 'Disconnect');
    expect(find.text('Disconnect your Discogs account?'), findsOneWidget);
    await tapText(tester, 'Keep connection');
    expect(find.text('Disconnect your Discogs account?'), findsNothing);
    expect(find.text('vinyl_fan'), findsOneWidget);
  });

  testWidgets('confirm disconnect → not connected', (tester) async {
    discogs.onDisconnect = () async {
      discogs.onStatus = () async => disconnectedStatus;
    };
    await pump(tester);
    await tapText(tester, 'Disconnect');
    await tapText(tester, 'Confirm disconnect');
    expect(find.text('Connect Discogs account'), findsOneWidget);
  });

  testWidgets('status error → message and Retry', (tester) async {
    discogs.onStatus = () async =>
        throw const ApiException(500, 'internal_error', 'x');
    await pump(tester);
    expect(
      find.text(
        'We could not load your Discogs connection right now. Please try '
        'again.',
      ),
      findsOneWidget,
    );
    discogs.onStatus = () async => connectedStatus;
    await tapText(tester, 'Retry');
    expect(find.text('vinyl_fan'), findsOneWidget);
  });

  testWidgets('dark mode switch saves; failure shows the banner', (
    tester,
  ) async {
    auth.themeSaveSucceeds = false;
    await pump(tester);
    final toggle = find.bySemanticsLabel('Dark mode');
    expect(
      tester.getSemantics(toggle),
      isSemantics(isToggled: false, hasToggledState: true),
    );

    await tester.tap(find.byType(Switch));
    await tester.pump();
    await tester.pump();

    expect(auth.themePreference, ThemePreference.dark);
    expect(
      find.text(
        "Your dark mode preference may not have been saved. It's applied "
        'now, but might not persist across devices or sessions.',
      ),
      findsOneWidget,
    );
  });

  testWidgets('sign out signs out', (tester) async {
    await pump(tester);
    await tapText(tester, 'Sign out');
    expect(auth.signOutCalls, 1);
  });
}
