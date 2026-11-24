import 'package:flutter_test/flutter_test.dart';
import 'package:material_ui/material_ui.dart';
import 'package:vinylmania/ui/core/widgets/confirm_dialog.dart';

import '../../../helpers/pump_screen.dart';

void main() {
  late bool? result;

  Future<void> open(WidgetTester tester) async {
    result = null;
    await pumpScreen(
      tester,
      Builder(
        builder: (context) => TextButton(
          onPressed: () async => result = await ConfirmDialog.show(
            context,
            title: 'Remove from wishlist?',
            message: 'This removes it from your Discogs wantlist too.',
            confirmLabel: 'Remove',
          ),
          child: const Text('open'),
        ),
      ),
    );
    await tester.tap(find.text('open'));
    await tester.pumpAndSettle();
  }

  testWidgets('confirm returns true', (tester) async {
    await open(tester);
    expect(find.text('Remove from wishlist?'), findsOneWidget);
    await expectA11yGuidelines(tester);

    await tester.tap(find.text('Remove'));
    await tester.pumpAndSettle();
    expect(result, isTrue);
  });

  testWidgets('cancel returns false', (tester) async {
    await open(tester);
    await tester.tap(find.text('Cancel'));
    await tester.pumpAndSettle();
    expect(result, isFalse);
  });

  testWidgets('dismissing returns false', (tester) async {
    await open(tester);
    await tester.tapAt(const Offset(5, 5));
    await tester.pumpAndSettle();
    expect(result, isFalse);
  });
}
