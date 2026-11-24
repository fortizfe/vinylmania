import 'package:flutter_test/flutter_test.dart';
import 'package:material_ui/material_ui.dart';
import 'package:vinylmania/ui/auth/widgets/splash_screen.dart';

import '../../../helpers/pump_screen.dart';

void main() {
  for (final mode in [ThemeMode.light, ThemeMode.dark]) {
    testWidgets('shows the wordmark and announces loading ($mode)', (
      tester,
    ) async {
      await pumpScreen(tester, const SplashScreen(), mode: mode);

      expect(find.text('VINYLMANIA'), findsOneWidget);
      expect(find.bySemanticsLabel('Loading Vinylmania'), findsOneWidget);
      expect(find.byType(CircularProgressIndicator), findsNothing);
      await expectA11yGuidelines(tester);
    });
  }
}
