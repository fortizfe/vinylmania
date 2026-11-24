import 'package:flutter_test/flutter_test.dart';
import 'package:material_ui/material_ui.dart';
import 'package:vinylmania/ui/core/theme/vinylmania_colors.dart';
import 'package:vinylmania/ui/core/widgets/release_rating_badge.dart';

import '../../../helpers/pump_screen.dart';

Color? _background(WidgetTester tester, String text) {
  final box = tester.widget<DecoratedBox>(
    find
        .ancestor(of: find.text(text), matching: find.byType(DecoratedBox))
        .first,
  );
  return (box.decoration as BoxDecoration).color;
}

void main() {
  for (final mode in [ThemeMode.light, ThemeMode.dark]) {
    testWidgets('bands, values and labels follow releaseRating.ts ($mode)', (
      tester,
    ) async {
      await pumpScreen(
        tester,
        const Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              ReleaseRatingBadge(average: 2.5, count: 3),
              ReleaseRatingBadge(average: 4.09, count: 3),
              ReleaseRatingBadge(average: 4.5, count: 3),
              ReleaseRatingBadge(average: 4.5),
              ReleaseRatingBadge(average: 7, count: 2),
            ],
          ),
        ),
        mode: mode,
      );
      final colors = VinylmaniaColors.of(
        tester.element(find.byType(ReleaseRatingBadge).first),
      );

      expect(_background(tester, '2.5'), colors.ratingLow);
      expect(_background(tester, '4.1'), colors.ratingMedium);
      expect(_background(tester, '4.5'), colors.ratingHigh);
      expect(find.text('-'), findsNWidgets(2));
      expect(find.bySemanticsLabel('Rating 2.5 out of 5'), findsOneWidget);
      expect(find.bySemanticsLabel('Rating not available'), findsNWidgets(2));
      await expectA11yGuidelines(tester);
    });
  }
}
