import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:material_ui/material_ui.dart';
import 'package:provider/provider.dart';
import 'package:provider/single_child_widget.dart';
import 'package:vinylmania/ui/core/theme/app_theme.dart';

const compactSize = Size(390, 844);
const expandedSize = Size(1280, 800);

/// Pumps [screen] at `/` inside the app themes, at [size] logical pixels.
///
/// Any other route renders `Text('route: <location>')`, so navigation can be
/// asserted with `find.text('route: /profile')`. Pumps one frame only: a
/// visible `Skeleton` pulses forever, so use `pump(duration)`, not
/// `pumpAndSettle`, while one is on screen.
Future<void> pumpScreen(
  WidgetTester tester,
  Widget screen, {
  Size size = compactSize,
  ThemeMode mode = ThemeMode.light,
  double textScale = 1,
  bool disableAnimations = false,
  List<SingleChildWidget> providers = const [],
}) async {
  tester.view
    ..physicalSize = size
    ..devicePixelRatio = 1;
  addTearDown(tester.view.reset);

  final router = GoRouter(
    routes: [GoRoute(path: '/', builder: (_, _) => screen)],
    errorBuilder: (_, state) => Scaffold(body: Text('route: ${state.uri}')),
  );
  Widget app = MaterialApp.router(
    theme: buildLightTheme(),
    darkTheme: buildDarkTheme(),
    themeMode: mode,
    routerConfig: router,
    builder: (context, child) => MediaQuery(
      data: MediaQuery.of(context).copyWith(
        textScaler: TextScaler.linear(textScale),
        disableAnimations: disableAnimations,
      ),
      // Screens bring their own Scaffold; bare widgets still need a surface.
      child: Material(child: child),
    ),
  );
  if (providers.isNotEmpty) {
    app = MultiProvider(providers: providers, child: app);
  }
  await tester.pumpWidget(app);
  await tester.pump();
}

/// The four built-in Flutter accessibility guidelines.
Future<void> expectA11yGuidelines(WidgetTester tester) async {
  await expectLater(tester, meetsGuideline(androidTapTargetGuideline));
  await expectLater(tester, meetsGuideline(iOSTapTargetGuideline));
  await expectLater(tester, meetsGuideline(labeledTapTargetGuideline));
  await expectLater(tester, meetsGuideline(textContrastGuideline));
}

/// Reduced motion (`disableAnimations`): every implicit animation and
/// switcher under [of] has a zero duration. Fails when there are none.
void expectInstantMotion(Finder of) {
  Duration? durationOf(Widget w) => switch (w) {
    ImplicitlyAnimatedWidget(:final duration) => duration,
    AnimatedSwitcher(:final duration) => duration,
    _ => null,
  };
  final durations = [
    for (final e
        in find
            .descendant(
              of: of,
              matching: find.byWidgetPredicate((w) => durationOf(w) != null),
            )
            .evaluate())
      durationOf(e.widget),
  ];
  expect(durations, isNotEmpty);
  expect(durations, everyElement(Duration.zero));
}
