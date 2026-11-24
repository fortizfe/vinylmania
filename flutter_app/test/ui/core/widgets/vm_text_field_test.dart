import 'package:flutter_test/flutter_test.dart';
import 'package:material_ui/material_ui.dart';
import 'package:vinylmania/ui/core/widgets/vm_text_field.dart';

import '../../../helpers/pump_screen.dart';

void main() {
  for (final mode in [ThemeMode.light, ThemeMode.dark]) {
    testWidgets('labelled field forwards input and submit ($mode)', (
      tester,
    ) async {
      final changes = <String>[];
      String? submitted;
      await pumpScreen(
        tester,
        Padding(
          padding: const EdgeInsets.all(16),
          child: VmTextField(
            label: 'Search',
            onChanged: changes.add,
            onSubmitted: (v) => submitted = v,
          ),
        ),
        mode: mode,
      );

      await tester.enterText(find.byType(TextField), 'abba');
      await tester.testTextInput.receiveAction(TextInputAction.done);

      expect(changes.last, 'abba');
      expect(submitted, 'abba');
      expect(find.text('Search'), findsOneWidget);
      await expectA11yGuidelines(tester);
    });
  }

  testWidgets('text scale 2.0 does not overflow', (tester) async {
    await pumpScreen(
      tester,
      const VmTextField(label: 'Notes', maxLines: 3),
      textScale: 2,
    );
    expect(tester.takeException(), isNull);
  });
}
