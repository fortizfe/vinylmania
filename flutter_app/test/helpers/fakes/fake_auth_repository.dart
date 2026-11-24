import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:vinylmania/data/repositories/auth_repository.dart';
import 'package:vinylmania/domain/models/auth/user_profile.dart';
import 'package:vinylmania/data/repositories/sign_in_outcome.dart';
import 'package:vinylmania/domain/models/auth/theme_preference.dart';

const testUser = UserProfile(
  uid: 'u1',
  displayName: 'Ada Lovelace',
  email: 'ada@example.com',
);

/// In-memory [AuthRepository]. Set the public fields to drive a test, read
/// the counters to assert calls.
class FakeAuthRepository extends ChangeNotifier implements AuthRepository {
  FakeAuthRepository({
    this.user,
    this.isRestoring = false,
    this.themePreference,
    this.signInOutcome = SignInOutcome.success,
    this.themeSaveSucceeds = true,
  });

  @override
  UserProfile? user;
  @override
  bool isRestoring;
  @override
  ThemePreference? themePreference;

  SignInOutcome signInOutcome;

  /// When set, [restore] waits for it before finishing.
  Completer<void>? pendingRestore;

  /// When set, [signIn] waits for it instead of returning [signInOutcome].
  Completer<SignInOutcome>? pendingSignIn;
  bool themeSaveSucceeds;
  int restoreCalls = 0;
  int signInCalls = 0;
  int signOutCalls = 0;

  @override
  bool get isSignedIn => user != null;

  @override
  Future<void> restore() async {
    restoreCalls++;
    await pendingRestore?.future;
    isRestoring = false;
    notifyListeners();
  }

  @override
  Future<SignInOutcome> signIn() async {
    signInCalls++;
    final outcome = pendingSignIn != null
        ? await pendingSignIn!.future
        : signInOutcome;
    if (outcome == SignInOutcome.success) {
      user = testUser;
      notifyListeners();
    }
    return outcome;
  }

  @override
  Future<void> signOut() async {
    signOutCalls++;
    user = null;
    notifyListeners();
  }

  @override
  Future<bool> setThemePreference(ThemePreference preference) async {
    themePreference = preference;
    notifyListeners();
    return themeSaveSucceeds;
  }

  /// Simulates a 401 anywhere in the app.
  void expireSession() {
    user = null;
    notifyListeners();
  }
}
