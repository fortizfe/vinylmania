import 'package:flutter_test/flutter_test.dart';
import 'package:material_ui/material_ui.dart';
import 'package:vinylmania/ui/core/widgets/vm_badge.dart';

import '../../../helpers/pump_screen.dart';

import 'package:vinylmania/ui/core/widgets/badge_tone.dart';

void main() {
  for (final mode in [ThemeMode.light, ThemeMode.dark]) {
    testWidgets('every tone renders readable text ($mode)', (tester) async {
      await pumpScreen(
        tester,
        const Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              VmBadge(label: 'Vinyl'),
              VmBadge(label: 'LP', tone: BadgeTone.muted),
              VmBadge(label: 'New', tone: BadgeTone.accent),
            ],
          ),
        ),
        mode: mode,
      );

      expect(find.text('New'), findsOneWidget);
      await expectA11yGuidelines(tester);
    });
  }
}
