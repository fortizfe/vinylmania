import 'package:flutter_test/flutter_test.dart';
import 'package:material_ui/material_ui.dart';
import 'package:vinylmania/ui/core/widgets/view_mode_toggle.dart';

import '../../../helpers/pump_screen.dart';

import 'package:vinylmania/ui/core/widgets/view_mode.dart';

void main() {
  for (final mode in [ThemeMode.light, ThemeMode.dark]) {
    testWidgets('radio semantics, selection and a11y ($mode)', (tester) async {
      final handle = tester.ensureSemantics();
      final changes = <ViewMode>[];
      await pumpScreen(
        tester,
        Center(
          child: ViewModeToggle(mode: ViewMode.grid, onChanged: changes.add),
        ),
        mode: mode,
      );

      expect(
        tester.getSemantics(find.bySemanticsLabel('Grid view')),
        isSemantics(isChecked: true, isInMutuallyExclusiveGroup: true),
      );
      expect(
        tester.getSemantics(find.bySemanticsLabel('List view')),
        isSemantics(isChecked: false),
      );

      await tester.tap(find.bySemanticsLabel('List view'));
      await tester.tap(find.bySemanticsLabel('Grid view'));
      expect(changes, [ViewMode.list]);
      await expectA11yGuidelines(tester);
      handle.dispose();
    });
  }
  testWidgets('reduced motion: the selection moves instantly', (tester) async {
    await pumpScreen(
      tester,
      Center(
        child: ViewModeToggle(mode: ViewMode.grid, onChanged: (_) {}),
      ),
      disableAnimations: true,
    );
    expectInstantMotion(find.byType(ViewModeToggle));
  });
}
