import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:material_ui/material_ui.dart';
import 'package:provider/provider.dart';
import 'package:vinylmania/data/repositories/auth_repository.dart';
import 'package:vinylmania/ui/core/widgets/app_shell.dart';
import 'package:vinylmania/ui/core/widgets/compact_nav_bar.dart';

import '../../../helpers/fakes/fake_auth_repository.dart';
import '../../../helpers/pump_screen.dart';

void main() {
  Future<void> pumpShell(
    WidgetTester tester,
    String location, {
    Size size = compactSize,
    ThemeMode mode = ThemeMode.light,
    double textScale = 1,
  }) => pumpScreen(
    tester,
    AppShell(location: location, child: const Text('content')),
    size: size,
    mode: mode,
    textScale: textScale,
    providers: [
      ChangeNotifierProvider<AuthRepository>.value(
        value: FakeAuthRepository(user: testUser),
      ),
    ],
  );

  void expectSelected(WidgetTester tester, String label, bool value) => expect(
    tester.getSemantics(find.bySemanticsLabel(label)),
    isSemantics(isSelected: value),
    reason: label,
  );

  group('compact', () {
    testWidgets('five tabs, wordmark and avatar; no rail', (tester) async {
      final handle = tester.ensureSemantics();
      await pumpShell(tester, '/');

      expect(find.byType(NavigationRail), findsNothing);
      for (final label in ['News', 'Search', 'Library', 'Wishlist', 'Stats']) {
        expect(find.bySemanticsLabel(label), findsOneWidget);
      }
      expect(find.bySemanticsLabel('Profile'), findsOneWidget);
      expect(find.text('VINYLMANIA'), findsOneWidget);
      expect(find.text('content'), findsOneWidget);
      final bar = tester.getRect(find.byType(CompactNavBar));
      expect(bar.bottom, compactSize.height);
      expect(bar.height, lessThan(100));
      expectSelected(tester, 'News', true);
      handle.dispose();
    });

    testWidgets('a tab goes to its path', (tester) async {
      await pumpShell(tester, '/');
      await tester.tap(find.bySemanticsLabel('Wishlist'));
      await tester.pumpAndSettle();
      expect(find.text('route: /wishlist'), findsOneWidget);
    });

    testWidgets('the avatar goes to /profile', (tester) async {
      await pumpShell(tester, '/');
      await tester.tap(find.bySemanticsLabel('Profile'));
      await tester.pumpAndSettle();
      expect(find.text('route: /profile'), findsOneWidget);
    });

    testWidgets('on /profile no tab is selected', (tester) async {
      final handle = tester.ensureSemantics();
      await pumpShell(tester, '/profile');
      for (final label in ['News', 'Search', 'Library', 'Wishlist', 'Stats']) {
        expectSelected(tester, label, false);
      }
      handle.dispose();
    });

    for (final mode in [ThemeMode.light, ThemeMode.dark]) {
      testWidgets('a11y guidelines ($mode)', (tester) async {
        await pumpShell(tester, '/library', mode: mode);
        await expectA11yGuidelines(tester);
      });
    }

    testWidgets('no overflow at text scale 2.0', (tester) async {
      await pumpShell(tester, '/', textScale: 2);
      expect(tester.takeException(), isNull);
    });
  });

  group('expanded', () {
    testWidgets('rail with six destinations incl. Profile', (tester) async {
      await pumpShell(tester, '/', size: expandedSize);

      final rail = tester.widget<NavigationRail>(find.byType(NavigationRail));
      expect(rail.destinations, hasLength(6));
      expect(find.text('Profile'), findsOneWidget);
    });

    testWidgets('a destination goes to its path', (tester) async {
      await pumpShell(tester, '/', size: expandedSize);
      await tester.tap(find.text('Stats'));
      await tester.pumpAndSettle();
      expect(find.text('route: /stats'), findsOneWidget);
    });

    for (final mode in [ThemeMode.light, ThemeMode.dark]) {
      testWidgets('a11y guidelines ($mode)', (tester) async {
        await pumpShell(tester, '/stats', size: expandedSize, mode: mode);
        await expectA11yGuidelines(tester);
      });
    }

    testWidgets('no overflow at text scale 2.0', (tester) async {
      await pumpShell(tester, '/', size: expandedSize, textScale: 2);
      expect(tester.takeException(), isNull);
    });
  });

  const prefixes = {
    '/': 0,
    '/search': 1,
    '/releases/12': 1,
    '/masters/3': 1,
    '/library': 2,
    '/library/records/abc': 2,
    '/wishlist': 3,
    '/stats': 4,
    '/profile': 5,
  };
  for (final MapEntry(key: location, value: index) in prefixes.entries) {
    testWidgets('selected destination for $location is $index', (tester) async {
      await pumpShell(tester, location, size: expandedSize);
      expect(
        tester
            .widget<NavigationRail>(find.byType(NavigationRail))
            .selectedIndex,
        index,
      );
    });
  }

  for (final (name, key) in [
    ('Cmd', LogicalKeyboardKey.metaLeft),
    ('Ctrl', LogicalKeyboardKey.controlLeft),
  ]) {
    testWidgets('$name+K goes to /search', (tester) async {
      await pumpShell(tester, '/library', size: expandedSize);

      await tester.sendKeyDownEvent(key);
      await tester.sendKeyEvent(LogicalKeyboardKey.keyK);
      await tester.sendKeyUpEvent(key);
      await tester.pumpAndSettle();

      expect(find.text('route: /search'), findsOneWidget);
    });
  }
}
