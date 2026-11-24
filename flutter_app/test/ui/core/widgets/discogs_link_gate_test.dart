import 'package:flutter_test/flutter_test.dart';
import 'package:material_ui/material_ui.dart';
import 'package:vinylmania/ui/core/widgets/discogs_link_gate.dart';

import '../../../helpers/pump_screen.dart';

void main() {
  testWidgets('page gate: library not linked copy, button goes to profile', (
    tester,
  ) async {
    await pumpScreen(
      tester,
      const DiscogsLinkGate(relink: false, context: 'library'),
    );

    expect(find.text('Link your Discogs account'), findsOneWidget);
    expect(
      find.text(
        'Your library is synchronized with your Discogs collection. Link your '
        'accounts from your profile to start using it.',
      ),
      findsOneWidget,
    );
    await tester.tap(find.text('Go to your profile'));
    await tester.pumpAndSettle();
    expect(find.text('route: /profile'), findsOneWidget);
  });

  testWidgets('page gate: stats relink copy', (tester) async {
    await pumpScreen(
      tester,
      const DiscogsLinkGate(relink: true, context: 'stats'),
    );

    expect(find.text('Your Discogs link is no longer valid'), findsOneWidget);
    expect(
      find.textContaining('keep using your collection stats.'),
      findsOneWidget,
    );
  });

  testWidgets('action gate: gateMessage copy for wishlist', (tester) async {
    await pumpScreen(
      tester,
      const DiscogsLinkGate(relink: false, context: 'add-to-wishlist'),
    );
    expect(
      find.text(
        'You need to link your Discogs account before adding records to your wishlist.',
      ),
      findsOneWidget,
    );

    await pumpScreen(
      tester,
      const DiscogsLinkGate(relink: true, context: 'add-to-library'),
    );
    expect(
      find.text(
        'Your Discogs link is no longer valid. Please re-link your account to '
        'add records to your library.',
      ),
      findsOneWidget,
    );
  });

  for (final mode in [ThemeMode.light, ThemeMode.dark]) {
    for (final size in [compactSize, expandedSize]) {
      testWidgets('a11y + text scale 2.0 ($mode, $size)', (tester) async {
        await pumpScreen(
          tester,
          const SingleChildScrollView(
            child: DiscogsLinkGate(relink: true, context: 'wishlist'),
          ),
          mode: mode,
          size: size,
          textScale: 2,
        );
        expect(tester.takeException(), isNull);
        await expectA11yGuidelines(tester);
      });
    }
  }
}
