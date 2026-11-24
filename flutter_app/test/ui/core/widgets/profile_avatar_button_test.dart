import 'package:flutter_test/flutter_test.dart';
import 'package:material_ui/material_ui.dart';
import 'package:provider/provider.dart';
import 'package:vinylmania/data/repositories/auth_repository.dart';
import 'package:vinylmania/ui/core/widgets/profile_avatar_button.dart';

import '../../../helpers/fakes/fake_auth_repository.dart';
import '../../../helpers/pump_screen.dart';

void main() {
  testWidgets('labelled 48 target that goes to /profile', (tester) async {
    await pumpScreen(
      tester,
      const Center(child: ProfileAvatarButton()),
      providers: [
        ChangeNotifierProvider<AuthRepository>.value(
          value: FakeAuthRepository(user: testUser),
        ),
      ],
    );

    expect(find.bySemanticsLabel('Profile'), findsOneWidget);
    await expectA11yGuidelines(tester);

    await tester.tap(find.byType(ProfileAvatarButton));
    await tester.pumpAndSettle();
    expect(find.text('route: /profile'), findsOneWidget);
  });
}
