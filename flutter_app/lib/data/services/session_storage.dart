import 'package:flutter_secure_storage/flutter_secure_storage.dart';

/// The backend session token, kept in the platform keychain/keystore.
class SessionStorage {
  SessionStorage({
    // The legacy macOS keychain needs no keychain-access-groups entitlement
    // (that one requires a signing team); the data-protection one fails
    // with -34018 without it.
    this._storage = const FlutterSecureStorage(
      mOptions: MacOsOptions(usesDataProtectionKeychain: false),
    ),
  });

  static const _key = 'vinylmania_session_token';

  final FlutterSecureStorage _storage;
  String? _token;
  bool _loaded = false;

  Future<String?> readToken() async {
    if (!_loaded) {
      _token = await _storage.read(key: _key);
      _loaded = true;
    }
    return _token;
  }

  Future<void> writeToken(String token) async {
    _token = token;
    _loaded = true;
    await _storage.write(key: _key, value: token);
  }

  Future<void> clear() async {
    _token = null;
    _loaded = true;
    await _storage.delete(key: _key);
  }
}
