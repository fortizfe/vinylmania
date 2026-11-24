import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:material_ui/material_ui.dart';
import 'package:vinylmania/ui/core/widgets/pressable.dart';

import '../../../helpers/pump_screen.dart';

double _scale(WidgetTester tester) =>
    tester.widget<AnimatedScale>(find.byType(AnimatedScale)).scale;

void main() {
  Widget subject(VoidCallback? onTap) => Center(
    child: Pressable(
      onTap: onTap,
      semanticLabel: 'Open',
      child: const SizedBox(width: 48, height: 48),
    ),
  );

  testWidgets('scales to 0.97 while pressed and fires onTap', (tester) async {
    var taps = 0;
    await pumpScreen(tester, subject(() => taps++));

    final gesture = await tester.startGesture(
      tester.getCenter(find.byType(Pressable)),
    );
    await tester.pump();
    expect(_scale(tester), 0.97);

    await gesture.up();
    await tester.pump();
    expect(_scale(tester), 1);
    expect(taps, 1);
  });

  testWidgets('does not scale under reduced motion', (tester) async {
    await pumpScreen(tester, subject(() {}), disableAnimations: true);

    await tester.startGesture(tester.getCenter(find.byType(Pressable)));
    await tester.pump();

    expect(_scale(tester), 1);
  });

  testWidgets('disabled: no scale, semantics disabled', (tester) async {
    final handle = tester.ensureSemantics();
    await pumpScreen(tester, subject(null));

    await tester.startGesture(tester.getCenter(find.byType(Pressable)));
    await tester.pump();

    expect(_scale(tester), 1);
    expect(
      tester.getSemantics(find.byType(Pressable)),
      isSemantics(
        label: 'Open',
        isButton: true,
        hasEnabledState: true,
        isEnabled: false,
      ),
    );
    handle.dispose();
  });

  testWidgets('keyboard focus shows a ring and Enter activates', (
    tester,
  ) async {
    var taps = 0;
    await pumpScreen(tester, subject(() => taps++));
    final ringFinder = find.byWidgetPredicate(
      (w) =>
          w is DecoratedBox &&
          w.decoration is BoxDecoration &&
          (w.decoration as BoxDecoration).border != null,
    );
    expect(ringFinder, findsNothing);

    await tester.sendKeyEvent(LogicalKeyboardKey.tab);
    await tester.pump();
    expect(ringFinder, findsOneWidget);

    await tester.sendKeyEvent(LogicalKeyboardKey.enter);
    await tester.pump();
    expect(taps, 1);
  });

  testWidgets('labelled tap target passes the a11y guidelines', (tester) async {
    await pumpScreen(tester, subject(() {}));
    await expectA11yGuidelines(tester);
  });
}
