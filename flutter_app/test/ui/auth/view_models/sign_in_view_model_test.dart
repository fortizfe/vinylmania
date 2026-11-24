import 'dart:async';

import 'package:flutter_test/flutter_test.dart';
import 'package:vinylmania/ui/auth/view_models/sign_in_view_model.dart';

import '../../../helpers/fakes/fake_auth_repository.dart';

import 'package:vinylmania/data/repositories/sign_in_outcome.dart';

void main() {
  test('success signs in without a message', () async {
    final repo = FakeAuthRepository();
    final vm = SignInViewModel(repo);

    await vm.signIn();

    expect(repo.signInCalls, 1);
    expect(vm.errorMessage, isNull);
    expect(vm.isSigningIn, isFalse);
  });

  test(
    'isSigningIn is true while in flight and repeated taps are ignored',
    () async {
      final pending = Completer<SignInOutcome>();
      final repo = FakeAuthRepository()..pendingSignIn = pending;
      final vm = SignInViewModel(repo);
      var notified = 0;
      vm.addListener(() => notified++);

      final first = vm.signIn();
      expect(vm.isSigningIn, isTrue);
      unawaited(vm.signIn());
      pending.complete(SignInOutcome.cancelled);
      await first;

      expect(repo.signInCalls, 1);
      expect(vm.isSigningIn, isFalse);
      expect(notified, 2);
    },
  );

  const messages = {
    SignInOutcome.cancelled: null,
    SignInOutcome.denied:
        'Sign-in was cancelled. You can try again whenever you are ready.',
    SignInOutcome.expired: 'This sign-in attempt expired. Please try again.',
    SignInOutcome.error:
        'Something went wrong while signing in. Please try again.',
  };
  for (final MapEntry(key: outcome, value: message) in messages.entries) {
    test('$outcome shows the web message', () async {
      final vm = SignInViewModel(FakeAuthRepository(signInOutcome: outcome));

      await vm.signIn();

      expect(vm.errorMessage, message);
    });
  }

  test('a new attempt clears the previous message', () async {
    final repo = FakeAuthRepository(signInOutcome: SignInOutcome.error);
    final vm = SignInViewModel(repo);
    await vm.signIn();

    repo.signInOutcome = SignInOutcome.cancelled;
    await vm.signIn();

    expect(vm.errorMessage, isNull);
  });

  test('a sign-in finishing after the screen is gone does not throw', () async {
    final pending = Completer<SignInOutcome>();
    final vm = SignInViewModel(FakeAuthRepository()..pendingSignIn = pending);

    final inFlight = vm.signIn();
    vm.dispose();
    pending.complete(SignInOutcome.success);

    await expectLater(inFlight, completes);
  });
}
