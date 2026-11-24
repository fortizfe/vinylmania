import 'package:flutter_test/flutter_test.dart';
import 'package:material_ui/material_ui.dart';
import 'package:vinylmania/ui/core/widgets/vm_avatar.dart';

import '../../../helpers/pump_screen.dart';

void main() {
  testWidgets('without a url shows a labelled placeholder of the size', (
    tester,
  ) async {
    await pumpScreen(
      tester,
      const Center(child: VmAvatar(semanticLabel: 'Ada Lovelace', size: 32)),
    );

    expect(find.bySemanticsLabel('Ada Lovelace'), findsOneWidget);
    expect(tester.getSize(find.byType(VmAvatar)), const Size(32, 32));
  });

  testWidgets('a failing image keeps the box and the label', (tester) async {
    await pumpScreen(
      tester,
      const Center(
        child: VmAvatar(url: 'https://img.test/a.png', semanticLabel: 'Ada'),
      ),
    );
    await tester.pump();

    expect(tester.getSize(find.byType(VmAvatar)), const Size(48, 48));
    expect(find.bySemanticsLabel('Ada'), findsOneWidget);
  });
}
