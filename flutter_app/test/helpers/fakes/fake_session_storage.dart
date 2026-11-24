import 'package:vinylmania/data/services/session_storage.dart';

class FakeSessionStorage implements SessionStorage {
  FakeSessionStorage([this.token]);

  String? token;

  /// When set, [readToken] throws it (keychain/keystore failure).
  Exception? readError;

  @override
  Future<String?> readToken() async {
    if (readError != null) throw readError!;
    return token;
  }

  @override
  Future<void> writeToken(String token) async => this.token = token;

  @override
  Future<void> clear() async => token = null;
}
