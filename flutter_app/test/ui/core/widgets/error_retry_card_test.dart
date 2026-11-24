import 'package:flutter_test/flutter_test.dart';
import 'package:material_ui/material_ui.dart';
import 'package:vinylmania/ui/core/widgets/error_retry_card.dart';

import '../../../helpers/pump_screen.dart';

void main() {
  for (final mode in [ThemeMode.light, ThemeMode.dark]) {
    testWidgets('shows the message and retries ($mode)', (tester) async {
      var retries = 0;
      await pumpScreen(
        tester,
        ErrorRetryCard(
          message: "We couldn't load your library.",
          onRetry: () => retries++,
        ),
        mode: mode,
      );

      expect(find.text("We couldn't load your library."), findsOneWidget);
      await tester.tap(find.text('Retry'));
      expect(retries, 1);
      await expectA11yGuidelines(tester);
    });
  }
}
