import 'package:flutter_test/flutter_test.dart';
import 'package:material_ui/material_ui.dart';
import 'package:vinylmania/ui/core/widgets/release_rating_badge.dart';
import 'package:vinylmania/ui/library/widgets/record_card.dart';
import 'package:vinylmania/ui/library/widgets/record_card_skeleton.dart';
import 'package:vinylmania/ui/library/widgets/record_list_row.dart';
import 'package:vinylmania/ui/library/widgets/record_list_row_skeleton.dart';

import '../../../helpers/fixtures/library_fixtures.dart';
import '../../../helpers/pump_screen.dart';

Widget _box(Widget child) => Align(
  alignment: Alignment.topLeft,
  child: SizedBox(width: 220, child: child),
);

void main() {
  testWidgets('card: cover, title, primary artist, community rating', (
    tester,
  ) async {
    var taps = 0;
    await pumpScreen(
      tester,
      _box(RecordCard(entry: libraryEntry, onTap: () => taps++)),
    );

    expect(find.text('Master Of Puppets'), findsOneWidget);
    expect(find.text('Metallica'), findsOneWidget);
    expect(
      tester
          .widget<ReleaseRatingBadge>(find.byType(ReleaseRatingBadge))
          .average,
      4.75,
    );
    await tester.tap(find.text('Master Of Puppets'));
    expect(taps, 1);
    await expectA11yGuidelines(tester);
  });

  testWidgets('row: artists, format, country, year and label', (tester) async {
    await pumpScreen(tester, RecordListRow(entry: libraryEntry, onTap: () {}));

    expect(find.text('Master Of Puppets'), findsOneWidget);
    expect(find.textContaining('Vinyl'), findsOneWidget);
    expect(find.textContaining('Elektra'), findsOneWidget);
    expect(find.textContaining('1986'), findsOneWidget);
    await expectA11yGuidelines(tester);
  });

  for (final (name, build) in [
    (
      'card',
      (VoidCallback tap) => RecordCard(entry: minimalLibraryEntry, onTap: tap),
    ),
    (
      'row',
      (VoidCallback tap) =>
          RecordListRow(entry: minimalLibraryEntry, onTap: tap),
    ),
  ]) {
    testWidgets('$name without catalog data offers Open record', (
      tester,
    ) async {
      var taps = 0;
      await pumpScreen(tester, _box(build(() => taps++)));

      expect(
        find.text("Couldn't load catalog details for this record right now."),
        findsOneWidget,
      );
      await tester.tap(find.text('Open record'));
      expect(taps, 1);
      await expectA11yGuidelines(tester);
    });
  }

  testWidgets('skeletons are hidden from screen readers', (tester) async {
    await pumpScreen(
      tester,
      _box(
        const Column(children: [RecordCardSkeleton(), RecordListRowSkeleton()]),
      ),
      disableAnimations: true,
    );

    expect(find.byType(RecordCardSkeleton), findsOneWidget);
    expect(find.byType(RecordListRowSkeleton), findsOneWidget);
  });
}
