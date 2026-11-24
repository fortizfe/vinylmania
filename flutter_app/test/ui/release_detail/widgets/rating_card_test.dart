import 'package:flutter_test/flutter_test.dart';
import 'package:material_ui/material_ui.dart';
import 'package:vinylmania/ui/core/widgets/star_rating.dart';
import 'package:vinylmania/ui/release_detail/view_models/save_status.dart';
import 'package:vinylmania/ui/release_detail/widgets/rating_card.dart';

import '../../../helpers/fixtures/catalog_fixtures.dart';
import '../../../helpers/pump_screen.dart';

void main() {
  testWidgets('community half: badge, vote count, have/want', (tester) async {
    await pumpScreen(tester, RatingCard(community: release.community));
    expect(find.text('Valoración'), findsOneWidget);
    expect(find.text('Comunidad de Discogs'), findsOneWidget);
    expect(find.bySemanticsLabel('Rating 4.8 out of 5'), findsOneWidget);
    expect(find.text('(3021)'), findsOneWidget);
    expect(find.text('50213 lo tienen · 9120 lo quieren'), findsOneWidget);
    // No personal rating outside the library/wishlist: plain text.
    expect(find.text('Sin valorar'), findsOneWidget);
    expect(find.byType(StarRating), findsNothing);
    await expectA11yGuidelines(tester);
  });

  testWidgets('no community data: "Sin valoraciones"', (tester) async {
    await pumpScreen(tester, const RatingCard(community: null));
    expect(find.text('Sin valoraciones'), findsOneWidget);
    expect(find.textContaining('lo tienen'), findsNothing);
  });

  testWidgets('personal stars save; failure offers Reintentar', (tester) async {
    int? saved;
    var retried = false;
    Future<void> pump(SaveStatus status) => pumpScreen(
      tester,
      RatingCard(
        community: release.community,
        personal: (
          value: 3,
          status: status,
          onChanged: (v) => saved = v,
          onRetry: () => retried = true,
        ),
      ),
      mode: ThemeMode.dark,
    );

    await pump(SaveStatus.idle);
    // The half's label + the star slider named after it.
    expect(find.bySemanticsLabel('Tu valoración'), findsNWidgets(2));
    await tester.tap(find.byKey(const ValueKey('star-5')));
    expect(saved, 5);
    await expectA11yGuidelines(tester);

    await pump(SaveStatus.failed);
    expect(find.text('No se pudo guardar tu valoración.'), findsOneWidget);
    await tester.tap(find.text('Reintentar'));
    expect(retried, isTrue);
    await expectA11yGuidelines(tester);
  });
}
