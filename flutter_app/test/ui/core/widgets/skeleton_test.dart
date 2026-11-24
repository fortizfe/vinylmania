import 'package:flutter_test/flutter_test.dart';
import 'package:material_ui/material_ui.dart';
import 'package:vinylmania/ui/core/widgets/skeleton.dart';

import '../../../helpers/pump_screen.dart';

double _opacity(WidgetTester tester) => tester
    .widget<FadeTransition>(
      find.descendant(
        of: find.byType(Skeleton),
        matching: find.byType(FadeTransition),
      ),
    )
    .opacity
    .value;

void main() {
  testWidgets('has the requested size and is hidden from semantics', (
    tester,
  ) async {
    final handle = tester.ensureSemantics();
    await pumpScreen(
      tester,
      const Center(child: Skeleton(width: 120, height: 20)),
    );

    expect(tester.getSize(find.byType(Skeleton)), const Size(120, 20));
    expect(tester.getSemantics(find.byType(Skeleton)).label, isEmpty);
    handle.dispose();
  });

  testWidgets('pulses when animations are enabled', (tester) async {
    await pumpScreen(tester, const Center(child: Skeleton(width: 40)));
    final start = _opacity(tester);

    await tester.pump(const Duration(milliseconds: 500));

    expect(_opacity(tester), isNot(start));
  });

  testWidgets('is static under reduced motion', (tester) async {
    await pumpScreen(
      tester,
      const Center(child: Skeleton(width: 40)),
      disableAnimations: true,
    );
    final start = _opacity(tester);

    await tester.pump(const Duration(milliseconds: 500));

    expect(_opacity(tester), start);
  });
}
