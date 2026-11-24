import 'package:flutter_test/flutter_test.dart';
import 'package:material_ui/material_ui.dart';
import 'package:vinylmania/ui/core/widgets/pressable.dart';
import 'package:vinylmania/ui/core/widgets/vm_card.dart';

import '../../../helpers/pump_screen.dart';

void main() {
  testWidgets('static card is not pressable', (tester) async {
    await pumpScreen(tester, const VmCard(child: Text('Body')));

    expect(find.text('Body'), findsOneWidget);
    expect(find.byType(Pressable), findsNothing);
  });

  for (final mode in [ThemeMode.light, ThemeMode.dark]) {
    testWidgets('tappable card presses at 0.99 and is accessible ($mode)', (
      tester,
    ) async {
      var taps = 0;
      await pumpScreen(
        tester,
        VmCard(onTap: () => taps++, child: const Text('Abbey Road')),
        mode: mode,
      );

      expect(
        tester.widget<Pressable>(find.byType(Pressable)).pressedScale,
        0.99,
      );
      await tester.tap(find.text('Abbey Road'));
      expect(taps, 1);
      await expectA11yGuidelines(tester);
    });
  }
}
