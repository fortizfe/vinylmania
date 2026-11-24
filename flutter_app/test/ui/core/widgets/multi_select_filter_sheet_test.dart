import 'package:flutter_test/flutter_test.dart';
import 'package:material_ui/material_ui.dart';
import 'package:vinylmania/ui/core/widgets/multi_select_filter_sheet.dart';

import '../../../helpers/pump_screen.dart';

void main() {
  late Set<String>? result;

  Future<void> open(WidgetTester tester, {Size size = compactSize}) async {
    result = {'sentinel'};
    await pumpScreen(
      tester,
      Builder(
        builder: (context) => TextButton(
          onPressed: () async => result = await MultiSelectFilterSheet.show(
            context,
            title: 'Genre',
            options: const ['Rock', 'Jazz', 'Hip Hop'],
            selected: const {'Jazz'},
          ),
          child: const Text('open'),
        ),
      ),
      size: size,
    );
    await tester.tap(find.text('open'));
    await tester.pumpAndSettle();
  }

  testWidgets('compact: bottom sheet, toggle and apply', (tester) async {
    await open(tester);
    expect(find.byType(BottomSheet), findsOneWidget);

    await tester.tap(find.text('Rock'));
    await tester.tap(find.text('Jazz'));
    await tester.pump();
    await tester.tap(find.text('Apply'));
    await tester.pumpAndSettle();

    expect(result, {'Rock'});
  });

  testWidgets('expanded: dialog; search narrows the list', (tester) async {
    await open(tester, size: expandedSize);
    expect(find.byType(Dialog), findsOneWidget);

    await tester.enterText(find.byType(TextField), 'ja');
    await tester.pump();

    expect(find.text('Jazz'), findsOneWidget);
    expect(find.text('Rock'), findsNothing);
    await expectA11yGuidelines(tester);
  });

  testWidgets('Clear returns an empty set', (tester) async {
    await open(tester);
    await tester.tap(find.text('Clear'));
    await tester.pumpAndSettle();
    expect(result, isEmpty);
  });

  testWidgets('dismissing returns null', (tester) async {
    await open(tester);
    await tester.tapAt(const Offset(5, 5));
    await tester.pumpAndSettle();
    expect(result, isNull);
  });

  testWidgets('selected options read as checked', (tester) async {
    final handle = tester.ensureSemantics();
    await open(tester);
    expect(
      tester.getSemantics(find.text('Jazz')),
      isSemantics(isChecked: true),
    );
    handle.dispose();
  });
}
