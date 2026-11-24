import 'dart:async';

import 'package:flutter_test/flutter_test.dart';
import 'package:material_ui/material_ui.dart';
import 'package:vinylmania/ui/auth/view_models/sign_in_view_model.dart';
import 'package:vinylmania/ui/auth/widgets/sign_in_compact_layout.dart';
import 'package:vinylmania/ui/auth/widgets/sign_in_expanded_layout.dart';
import 'package:vinylmania/ui/auth/widgets/sign_in_screen.dart';
import 'package:vinylmania/ui/core/widgets/vm_button.dart';

import '../../../helpers/fakes/fake_auth_repository.dart';
import '../../../helpers/pump_screen.dart';

import 'package:vinylmania/data/repositories/sign_in_outcome.dart';

void main() {
  Finder button() => find.widgetWithText(VmButton, 'Continue with Google');

  for (final (size, layout) in [
    (compactSize, SignInCompactLayout),
    (expandedSize, SignInExpandedLayout),
  ]) {
    for (final mode in [ThemeMode.light, ThemeMode.dark]) {
      testWidgets('$layout shows the brand, pillars and button ($mode)', (
        tester,
      ) async {
        await pumpScreen(
          tester,
          SignInScreen(
            createViewModel: () => SignInViewModel(FakeAuthRepository()),
          ),
          size: size,
          mode: mode,
        );

        expect(find.byType(layout), findsOneWidget);
        expect(find.text('VINYLMANIA'), findsOneWidget);
        expect(
          find.text(
            'Track your collection with Discogs, rate every record, and follow '
            'curated rock and metal news — all in one place.',
          ),
          findsOneWidget,
        );
        expect(find.text('Your catalog, powered by Discogs'), findsOneWidget);
        expect(find.text('Personal ratings for every record'), findsOneWidget);
        expect(find.text('Curated rock and metal news'), findsOneWidget);
        expect(button(), findsOneWidget);
        await expectA11yGuidelines(tester);
      });
    }

    testWidgets('$layout has no overflow at text scale 2.0', (tester) async {
      await pumpScreen(
        tester,
        SignInScreen(
          createViewModel: () => SignInViewModel(FakeAuthRepository()),
        ),
        size: size,
        textScale: 2,
      );
      expect(tester.takeException(), isNull);
    });
  }

  testWidgets('in flight: button disabled, same size, nothing moves', (
    tester,
  ) async {
    final pending = Completer<SignInOutcome>();
    final repo = FakeAuthRepository()..pendingSignIn = pending;
    await pumpScreen(
      tester,
      SignInScreen(createViewModel: () => SignInViewModel(repo)),
    );
    final before = tester.getRect(button());
    final pillarBefore = tester.getRect(
      find.text('Curated rock and metal news'),
    );

    await tester.tap(button());
    await tester.pump();

    expect(tester.getRect(button()), before);
    expect(
      tester.getRect(find.text('Curated rock and metal news')),
      pillarBefore,
    );
    await tester.tap(button());
    expect(repo.signInCalls, 1);
    pending.complete(SignInOutcome.cancelled);
    await tester.pump();
  });

  testWidgets('a failed attempt shows the message as an alert', (tester) async {
    final handle = tester.ensureSemantics();
    await pumpScreen(
      tester,
      SignInScreen(
        createViewModel: () => SignInViewModel(
          FakeAuthRepository(signInOutcome: SignInOutcome.expired),
        ),
      ),
    );

    await tester.tap(button());
    await tester.pump();

    const message = 'This sign-in attempt expired. Please try again.';
    expect(find.text(message), findsOneWidget);
    expect(
      tester.getSemantics(find.text(message)),
      isSemantics(isLiveRegion: true),
    );
    handle.dispose();
  });
}
