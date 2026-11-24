import 'package:flutter_test/flutter_test.dart';
import 'package:material_ui/material_ui.dart';
import 'package:vinylmania/ui/core/widgets/dismissible_banner.dart';

import '../../../helpers/pump_screen.dart';

import 'package:vinylmania/ui/core/widgets/banner_tone.dart';

void main() {
  for (final mode in [ThemeMode.light, ThemeMode.dark]) {
    for (final tone in BannerTone.values) {
      testWidgets('$tone banner is readable and dismissible ($mode)', (
        tester,
      ) async {
        var dismissed = 0;
        await pumpScreen(
          tester,
          DismissibleBanner(
            text: 'Discogs account linked.',
            tone: tone,
            onDismiss: () => dismissed++,
          ),
          mode: mode,
        );

        await tester.tap(find.bySemanticsLabel('Dismiss'));
        expect(dismissed, 1);
        await expectA11yGuidelines(tester);
      });
    }
  }

  testWidgets('is a live region', (tester) async {
    final handle = tester.ensureSemantics();
    await pumpScreen(
      tester,
      DismissibleBanner(
        text: 'Saved',
        tone: BannerTone.success,
        onDismiss: () {},
      ),
    );
    expect(
      tester.getSemantics(find.text('Saved')),
      isSemantics(isLiveRegion: true),
    );
    handle.dispose();
  });
}
