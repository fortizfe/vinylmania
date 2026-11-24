import 'package:flutter/foundation.dart';

import '../../../data/repositories/auth_repository.dart';
import '../../../data/repositories/discogs_connection_repository.dart';
import '../../../domain/api_exception.dart';
import '../../../domain/models/discogs/discogs_connection_status.dart';
import '../../../domain/models/auth/theme_preference.dart';
import '../../../domain/models/discogs/discogs_link_outcome.dart';

/// Profile screen: appearance, the Discogs connection and sign out.
class ProfileViewModel extends ChangeNotifier {
  ProfileViewModel({
    required this.authRepository,
    required this.discogsConnectionRepository,
  });

  final AuthRepository authRepository;
  final DiscogsConnectionRepository discogsConnectionRepository;

  /// The web's `OUTCOME_MESSAGES` (ProfilePage).
  static const _linkMessages = {
    DiscogsLinkOutcome.linked: 'Discogs account linked.',
    DiscogsLinkOutcome.denied:
        'The Discogs connection was not completed. You can try again '
        'whenever you like.',
    DiscogsLinkOutcome.expired:
        'This link attempt expired. Please start again from your profile.',
    DiscogsLinkOutcome.error:
        'Something went wrong while linking your Discogs account. Please try '
        'again.',
  };

  bool _isLoadingStatus = true;
  DiscogsConnectionStatus? _status;
  bool _hasStatusError = false;
  bool _isLinking = false;
  bool _isConfirmingDisconnect = false;
  bool _isDisconnecting = false;
  DiscogsLinkOutcome? _linkOutcome;
  bool _themeSaveFailed = false;
  bool _disposed = false;

  bool get isLoadingStatus => _isLoadingStatus;
  DiscogsConnectionStatus? get status => _status;
  bool get hasStatusError => _hasStatusError;
  bool get isLinking => _isLinking;
  bool get isConfirmingDisconnect => _isConfirmingDisconnect;
  bool get isDisconnecting => _isDisconnecting;

  /// Outcome of the last link attempt, until dismissed.
  String? get linkMessage => _linkMessages[_linkOutcome];
  bool get linkSucceeded => _linkOutcome == DiscogsLinkOutcome.linked;
  bool get themeSaveFailed => _themeSaveFailed;

  Future<void> load() async {
    _isLoadingStatus = true;
    _hasStatusError = false;
    _notify();
    try {
      _status = await discogsConnectionRepository.status();
    } on ApiException {
      _status = null;
      _hasStatusError = true;
    }
    _isLoadingStatus = false;
    _notify();
  }

  Future<void> link() async {
    _isLinking = true;
    _linkOutcome = null;
    _notify();
    _linkOutcome = await discogsConnectionRepository.link();
    _isLinking = false;
    _notify();
    if (_linkOutcome == DiscogsLinkOutcome.linked) await _reloadStatus();
  }

  void dismissLinkMessage() {
    _linkOutcome = null;
    _notify();
  }

  void askDisconnect() {
    _isConfirmingDisconnect = true;
    _notify();
  }

  void cancelDisconnect() {
    _isConfirmingDisconnect = false;
    _notify();
  }

  Future<void> confirmDisconnect() async {
    _isDisconnecting = true;
    _notify();
    try {
      await discogsConnectionRepository.disconnect();
    } on ApiException {
      // Like the web: settle and show whatever the backend now says.
    }
    _isDisconnecting = false;
    _isConfirmingDisconnect = false;
    await _reloadStatus();
  }

  /// Applies at once; a failed save only raises the banner.
  Future<void> setDarkMode(bool dark) async {
    final saved = await authRepository.setThemePreference(
      dark ? ThemePreference.dark : ThemePreference.light,
    );
    _themeSaveFailed = !saved;
    _notify();
  }

  void dismissThemeSaveFailure() {
    _themeSaveFailed = false;
    _notify();
  }

  /// The router sends the user to sign-in once the session is gone.
  Future<void> signOut() => authRepository.signOut();

  /// Refreshes without the skeleton, so the card never jumps.
  Future<void> _reloadStatus() async {
    try {
      _status = await discogsConnectionRepository.status();
      _hasStatusError = false;
    } on ApiException {
      _hasStatusError = _status == null;
    }
    _notify();
  }

  void _notify() {
    if (!_disposed) notifyListeners();
  }

  @override
  void dispose() {
    _disposed = true;
    super.dispose();
  }
}
