import 'package:flutter_test/flutter_test.dart';
import 'package:vinylmania/app/app.dart';

void main() {
  testWidgets('App boots showing the Vinylmania title', (tester) async {
    await tester.pumpWidget(const App());

    expect(find.text('Vinylmania'), findsOneWidget);
  });
}
