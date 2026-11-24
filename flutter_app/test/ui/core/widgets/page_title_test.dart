import 'package:flutter_test/flutter_test.dart';
import 'package:material_ui/material_ui.dart';
import 'package:vinylmania/ui/core/widgets/page_title.dart';

import '../../../helpers/pump_screen.dart';

void main() {
  testWidgets('renders an Anton header', (tester) async {
    final handle = tester.ensureSemantics();
    await pumpScreen(tester, const PageTitle('Your library'));

    final text = tester.widget<Text>(find.text('Your library'));
    expect(text.style?.fontFamily, 'Anton');
    expect(
      tester.getSemantics(find.text('Your library')),
      isSemantics(label: 'Your library', isHeader: true),
    );
    handle.dispose();
  });

  testWidgets('wraps at text scale 2.0 without overflow', (tester) async {
    await pumpScreen(
      tester,
      const PageTitle('Collection stats and valuation overview'),
      textScale: 2,
    );
    expect(tester.takeException(), isNull);
  });
}
