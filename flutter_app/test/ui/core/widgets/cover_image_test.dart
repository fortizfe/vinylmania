import 'package:flutter_test/flutter_test.dart';
import 'package:material_ui/material_ui.dart';
import 'package:vinylmania/ui/core/widgets/cover_image.dart';

import '../../../helpers/pump_screen.dart';

void main() {
  Widget subject(String? url) => Center(
    child: SizedBox(
      width: 200,
      child: CoverImage(url: url, semanticLabel: 'Abbey Road cover'),
    ),
  );

  testWidgets('null url: labelled placeholder in a fixed box', (tester) async {
    await pumpScreen(tester, subject(null));

    expect(tester.getSize(find.byType(CoverImage)), const Size(200, 200));
    expect(find.bySemanticsLabel('Abbey Road cover'), findsOneWidget);
  });

  testWidgets('a failing image keeps the box', (tester) async {
    await pumpScreen(tester, subject('https://img.test/cover.jpg'));
    await tester.pump();

    expect(tester.getSize(find.byType(CoverImage)), const Size(200, 200));
    expect(find.bySemanticsLabel('Abbey Road cover'), findsOneWidget);
  });
}
