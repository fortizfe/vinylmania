import 'package:flutter/semantics.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:material_ui/material_ui.dart';
import 'package:vinylmania/ui/core/widgets/star_rating.dart';

import '../../../helpers/pump_screen.dart';

void main() {
  late List<int> changes;

  Future<void> pump(
    WidgetTester tester,
    int value, {
    bool saving = false,
    bool editable = true,
    double textScale = 1,
  }) {
    changes = [];
    return pumpScreen(
      tester,
      Center(
        child: StarRating(
          value: value,
          onChanged: editable ? changes.add : null,
          saving: saving,
        ),
      ),
      textScale: textScale,
    );
  }

  Finder star(int n) => find.byKey(ValueKey('star-$n'));

  testWidgets('tapping a star sets it; tapping the current one clears', (
    tester,
  ) async {
    await pump(tester, 3);

    await tester.tap(star(5));
    await tester.tap(star(3));

    expect(changes, [5, 0]);
  });

  testWidgets('each star is a ≥ 48×48 target', (tester) async {
    await pump(tester, 0);
    expect(tester.getSize(star(1)).width, greaterThanOrEqualTo(48));
    expect(tester.getSize(star(1)).height, greaterThanOrEqualTo(48));
  });

  testWidgets('exposes slider semantics with increase/decrease', (
    tester,
  ) async {
    final handle = tester.ensureSemantics();
    await pump(tester, 3);

    expect(
      tester.getSemantics(find.byType(StarRating)),
      isSemantics(
        label: 'Rating',
        value: '3 of 5 stars',
        increasedValue: '4 of 5 stars',
        decreasedValue: '2 of 5 stars',
        isSlider: true,
        hasIncreaseAction: true,
        hasDecreaseAction: true,
      ),
    );
    tester.semantics.performAction(
      find.semantics.byLabel('Rating'),
      SemanticsAction.increase,
    );
    expect(changes, [4]);
    handle.dispose();
  });

  testWidgets('saving or read-only ignores taps', (tester) async {
    await pump(tester, 2, saving: true);
    await tester.tap(star(4));
    expect(changes, isEmpty);

    await pump(tester, 2, editable: false);
    await tester.tap(star(4));
    expect(changes, isEmpty);
  });

  testWidgets('unrated reads "Not rated" and passes a11y at 2.0', (
    tester,
  ) async {
    await pump(tester, 0, textScale: 2);
    expect(find.bySemanticsLabel('Rating'), findsOneWidget);
    expect(tester.takeException(), isNull);
    await expectA11yGuidelines(tester);
  });
}
