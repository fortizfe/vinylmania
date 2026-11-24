import 'package:flutter/foundation.dart';

import '../../config/api_config.dart';
import '../../domain/models/auth/user_profile.dart';
import '../services/api_client.dart';
import '../../domain/api_exception.dart';
import '../services/auth_api.dart';
import '../services/oauth_browser.dart';
import '../services/pkce.dart';
import '../services/session_storage.dart';
import 'sign_in_outcome.dart';
import '../../domain/models/auth/theme_preference.dart';

/// Source of truth for the session: who is signed in and their theme.
class AuthRepository extends ChangeNotifier {
  AuthRepository({
    required this._authApi,
    required this._sessionStorage,
    required this._oauthBrowser,
    required ApiClient apiClient,
  }) {
    apiClient.onUnauthorized = _signedOut;
  }

  final AuthApi _authApi;
  final SessionStorage _sessionStorage;
  final OAuthBrowser _oauthBrowser;

  bool _isRestoring = true;
  UserProfile? _user;
  ThemePreference? _themePreference;

  bool get isRestoring => _isRestoring;
  UserProfile? get user => _user;
  bool get isSignedIn => _user != null;
  ThemePreference? get themePreference => _themePreference;

  Future<void> restore() async {
    try {
      if (await _sessionStorage.readToken() != null) {
        _setUser(await _authApi.me());
      }
    } on Exception {
      // A 401 already cleared the token in ApiClient; anything else (offline,
      // keychain failure) leaves the user signed out until the next start,
      // as the web does.
      _user = null;
    } finally {
      _isRestoring = false;
      notifyListeners();
    }
  }

  Future<SignInOutcome> signIn() async {
    final pkce = createPkcePair();
    final authorizeUri = Uri.parse('$apiBaseUrl/api/auth/google/authorize')
        .replace(
          queryParameters: {
            'client': 'native',
            'code_challenge': pkce.challenge,
          },
        );
    try {
      final callback = await _oauthBrowser.authenticate(authorizeUri);
      if (callback == null) return SignInOutcome.cancelled;
      final params = callback.queryParameters;
      if (params['error'] != null) return SignInOutcome.denied;
      final state = params['state'];
      if (state == null) return SignInOutcome.error;

      final result = await _authApi.completeGoogle(
        state: state,
        code: params['code'],
        codeVerifier: pkce.verifier,
      );
      await _sessionStorage.writeToken(result.sessionToken);
      _setUser(result.user);
      notifyListeners();
      return SignInOutcome.success;
    } on ApiException catch (e) {
      return e.code == 'expired_state'
          ? SignInOutcome.expired
          : SignInOutcome.error;
    } on Exception {
      return SignInOutcome.error;
    }
  }

  Future<void> signOut() async {
    try {
      await _authApi.deleteSession();
    } on ApiException {
      // Signing out locally must never fail.
    }
    await _sessionStorage.clear();
    _signedOut();
  }

  /// Optimistic: the choice applies at once and stays even if the save
  /// fails; false tells the UI to show the save-failure banner.
  // ponytail: no retry/backoff queue like the web's; add if saves flake.
  Future<bool> setThemePreference(ThemePreference preference) async {
    _themePreference = preference;
    notifyListeners();
    try {
      await _authApi.setThemePreference(preference);
      return true;
    } on ApiException {
      return false;
    }
  }

  void _setUser(UserProfile user) {
    _user = user;
    _themePreference = user.themePreference ?? _themePreference;
  }

  void _signedOut() {
    _user = null;
    notifyListeners();
  }
}
