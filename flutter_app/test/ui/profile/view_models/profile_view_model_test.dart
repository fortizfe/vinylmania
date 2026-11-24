import 'dart:async';

import 'package:flutter_test/flutter_test.dart';
import 'package:vinylmania/domain/api_exception.dart';
import 'package:vinylmania/ui/profile/view_models/profile_view_model.dart';

import '../../../helpers/fakes/fake_auth_repository.dart';
import '../../../helpers/fakes/fake_discogs_connection_repository.dart';
import '../../../helpers/fixtures/discogs_fixtures.dart';

import 'package:vinylmania/domain/models/auth/theme_preference.dart';
import 'package:vinylmania/domain/models/discogs/discogs_link_outcome.dart';

void main() {
  late FakeAuthRepository auth;
  late FakeDiscogsConnectionRepository discogs;
  late ProfileViewModel vm;

  setUp(() {
    auth = FakeAuthRepository(user: testUser);
    discogs = FakeDiscogsConnectionRepository();
    vm = ProfileViewModel(
      authRepository: auth,
      discogsConnectionRepository: discogs,
    );
  });

  group('Discogs status', () {
    test('loading, then the status', () async {
      expect(vm.isLoadingStatus, isTrue);
      await vm.load();
      expect(vm.isLoadingStatus, isFalse);
      expect(vm.status, same(connectedStatus));
      expect(vm.hasStatusError, isFalse);
    });

    test('failure → error; load again recovers', () async {
      discogs.onStatus = () async =>
          throw const ApiException(500, 'internal_error', 'x');
      await vm.load();
      expect(vm.hasStatusError, isTrue);
      expect(vm.status, isNull);

      discogs.onStatus = () async => disconnectedStatus;
      await vm.load();
      expect(vm.hasStatusError, isFalse);
      expect(vm.status!.connected, isFalse);
    });
  });

  group('link', () {
    const messages = {
      DiscogsLinkOutcome.linked: 'Discogs account linked.',
      DiscogsLinkOutcome.denied:
          'The Discogs connection was not completed. You can try again '
          'whenever you like.',
      DiscogsLinkOutcome.expired:
          'This link attempt expired. Please start again from your profile.',
      DiscogsLinkOutcome.error:
          'Something went wrong while linking your Discogs account. Please '
          'try again.',
    };

    for (final MapEntry(key: outcome, value: text) in messages.entries) {
      test('$outcome → banner text', () async {
        discogs.onLink = () async => outcome;
        await vm.link();
        expect(vm.linkMessage, text);
        expect(vm.linkSucceeded, outcome == DiscogsLinkOutcome.linked);

        vm.dismissLinkMessage();
        expect(vm.linkMessage, isNull);
      });
    }

    test('in flight while linking, then reloads the status', () async {
      discogs.onStatus = () async => disconnectedStatus;
      await vm.load();
      final pending = Completer<DiscogsLinkOutcome>();
      discogs.onLink = () => pending.future;
      discogs.onStatus = () async => connectedStatus;

      final linking = vm.link();
      expect(vm.isLinking, isTrue);
      pending.complete(DiscogsLinkOutcome.linked);
      await linking;

      expect(vm.isLinking, isFalse);
      expect(vm.status!.connected, isTrue);
    });
  });

  group('disconnect', () {
    test('asks first; keep connection cancels', () async {
      await vm.load();
      vm.askDisconnect();
      expect(vm.isConfirmingDisconnect, isTrue);
      vm.cancelDisconnect();
      expect(vm.isConfirmingDisconnect, isFalse);
    });

    test('confirm disconnects and reloads the status', () async {
      await vm.load();
      var disconnected = false;
      discogs.onDisconnect = () async => disconnected = true;
      discogs.onStatus = () async => disconnectedStatus;
      vm.askDisconnect();

      await vm.confirmDisconnect();

      expect(disconnected, isTrue);
      expect(vm.isConfirmingDisconnect, isFalse);
      expect(vm.isDisconnecting, isFalse);
      expect(vm.status!.connected, isFalse);
    });

    test('a failed disconnect still settles and reloads', () async {
      await vm.load();
      discogs.onDisconnect = () async =>
          throw const ApiException(500, 'internal_error', 'x');
      vm.askDisconnect();
      await vm.confirmDisconnect();
      expect(vm.isDisconnecting, isFalse);
      expect(vm.status!.connected, isTrue);
    });

    test('a failed reload keeps the last status, no error card', () async {
      await vm.load();
      discogs.onStatus = () async =>
          throw const ApiException(0, 'network_error', 'x');
      vm.askDisconnect();
      await vm.confirmDisconnect();
      expect(vm.status, same(connectedStatus));
      expect(vm.hasStatusError, isFalse);
    });
  });

  group('theme', () {
    test('sets the preference; no banner when saved', () async {
      await vm.setDarkMode(true);
      expect(auth.themePreference, ThemePreference.dark);
      expect(vm.themeSaveFailed, isFalse);
      await vm.setDarkMode(false);
      expect(auth.themePreference, ThemePreference.light);
    });

    test(
      'save failure → banner, dismissible, reset by a later success',
      () async {
        auth.themeSaveSucceeds = false;
        await vm.setDarkMode(true);
        expect(auth.themePreference, ThemePreference.dark);
        expect(vm.themeSaveFailed, isTrue);

        vm.dismissThemeSaveFailure();
        expect(vm.themeSaveFailed, isFalse);

        await vm.setDarkMode(false);
        expect(vm.themeSaveFailed, isTrue);
        auth.themeSaveSucceeds = true;
        await vm.setDarkMode(true);
        expect(vm.themeSaveFailed, isFalse);
      },
    );
  });

  test('signOut signs out of the auth repository', () async {
    await vm.signOut();
    expect(auth.signOutCalls, 1);
    expect(auth.user, isNull);
  });
}
