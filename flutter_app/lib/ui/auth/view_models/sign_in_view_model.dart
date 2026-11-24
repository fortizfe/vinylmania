import 'package:flutter/foundation.dart';

import '../../../data/repositories/auth_repository.dart';
import '../../../data/repositories/sign_in_outcome.dart';

/// Sign-in screen state: the in-flight flag and the outcome message.
class SignInViewModel extends ChangeNotifier {
  SignInViewModel(this._authRepository);

  final AuthRepository _authRepository;

  bool _disposed = false;
  bool _isSigningIn = false;
  String? _errorMessage;

  bool get isSigningIn => _isSigningIn;

  /// The web's `friendlyOutcomeMessage`; null after success or cancel.
  String? get errorMessage => _errorMessage;

  Future<void> signIn() async {
    if (_isSigningIn) return;
    _isSigningIn = true;
    _errorMessage = null;
    notifyListeners();

    final outcome = await _authRepository.signIn();
    _errorMessage = switch (outcome) {
      SignInOutcome.success || SignInOutcome.cancelled => null,
      SignInOutcome.denied =>
        'Sign-in was cancelled. You can try again whenever you are ready.',
      SignInOutcome.expired =>
        'This sign-in attempt expired. Please try again.',
      SignInOutcome.error =>
        'Something went wrong while signing in. Please try again.',
    };
    _isSigningIn = false;
    // Success redirects away and disposes the screen mid-flight.
    if (!_disposed) notifyListeners();
  }

  @override
  void dispose() {
    _disposed = true;
    super.dispose();
  }
}
