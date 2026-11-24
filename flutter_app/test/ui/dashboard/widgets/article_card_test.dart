import 'package:flutter_test/flutter_test.dart';
import 'package:material_ui/material_ui.dart';
import 'package:vinylmania/ui/dashboard/widgets/article_card.dart';
import 'package:vinylmania/ui/dashboard/widgets/article_card_skeleton.dart';
import 'package:vinylmania/ui/dashboard/widgets/article_card_variant.dart';

import '../../../helpers/fixtures/feeds_fixtures.dart';
import '../../../helpers/pump_screen.dart';

void main() {
  for (final variant in ArticleCardVariant.values) {
    for (final (size, textScale) in [
      (compactSize, 1.0),
      (compactSize, 2.0),
      (expandedSize, 1.0),
      (expandedSize, 2.0),
    ]) {
      testWidgets('$variant skeleton takes the card\'s exact size '
          '(scale $textScale, ${size.width} px)', (tester) async {
        await pumpScreen(
          tester,
          Align(
            alignment: Alignment.topLeft,
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                SizedBox(
                  width: 180,
                  child: ArticleCard(
                    article: feedsDashboard.categories[0].articles[0],
                    variant: variant,
                  ),
                ),
                SizedBox(
                  width: 180,
                  child: ArticleCardSkeleton(variant: variant),
                ),
              ],
            ),
          ),
          size: size,
          textScale: textScale,
          disableAnimations: true,
        );

        expect(
          tester.getSize(find.byType(ArticleCardSkeleton)),
          tester.getSize(find.byType(ArticleCard)),
        );
      });
    }
  }

  testWidgets('without an image the source monogram stands in', (tester) async {
    await pumpScreen(
      tester,
      SizedBox(
        width: 180,
        child: ArticleCard(
          article: feedsDashboard.categories[1].articles[0],
          variant: ArticleCardVariant.row,
        ),
      ),
    );

    expect(find.text('RS'), findsOneWidget);
  });
}
