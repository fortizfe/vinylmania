import 'package:flutter_test/flutter_test.dart';
import 'package:material_ui/material_ui.dart';
import 'package:vinylmania/ui/core/widgets/vm_button.dart';

import '../../../helpers/pump_screen.dart';

void main() {
  for (final mode in [ThemeMode.light, ThemeMode.dark]) {
    testWidgets('variants meet targets, labels and contrast ($mode)', (
      tester,
    ) async {
      await pumpScreen(
        tester,
        Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              VmButton.primary(onPressed: () {}, label: 'Save'),
              VmButton.secondary(onPressed: () {}, label: 'Cancel'),
              VmButton.icon(
                onPressed: () {},
                label: 'Refresh',
                icon: Icons.refresh,
              ),
            ],
          ),
        ),
        mode: mode,
      );

      expect(find.text('Save'), findsOneWidget);
      expect(find.bySemanticsLabel('Refresh'), findsOneWidget);
      expect(tester.getSize(find.byType(VmButton).last), const Size(48, 48));
      await expectA11yGuidelines(tester);
    });
  }

  testWidgets('tapping calls onPressed', (tester) async {
    var taps = 0;
    await pumpScreen(
      tester,
      Center(
        child: VmButton.primary(onPressed: () => taps++, label: 'Go'),
      ),
    );

    await tester.tap(find.text('Go'));
    expect(taps, 1);
  });

  testWidgets('loading keeps the width, disables and stays labelled', (
    tester,
  ) async {
    var taps = 0;
    Widget button(bool loading) => Center(
      child: VmButton.primary(
        onPressed: () => taps++,
        label: 'Continue with Google',
        loading: loading,
      ),
    );
    await pumpScreen(tester, button(false));
    final idle = tester.getSize(find.byType(VmButton));

    await pumpScreen(tester, button(true));
    expect(tester.getSize(find.byType(VmButton)), idle);
    await tester.tap(find.byType(VmButton));
    expect(taps, 0);
    expect(find.bySemanticsLabel('Continue with Google'), findsOneWidget);
  });

  testWidgets('text scale 2.0 does not overflow', (tester) async {
    await pumpScreen(
      tester,
      Center(
        child: VmButton.primary(onPressed: () {}, label: 'Add to library'),
      ),
      textScale: 2,
    );
    expect(tester.takeException(), isNull);
  });
}
