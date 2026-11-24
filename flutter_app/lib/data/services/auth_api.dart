import '../../domain/models/auth/user_profile.dart';
import 'api_client.dart';
import '../../domain/models/auth/theme_preference.dart';

/// `/api/auth/*`.
class AuthApi {
  AuthApi(this._client);

  final ApiClient _client;

  Future<({String sessionToken, UserProfile user})> completeGoogle({
    required String state,
    String? code,
    String? error,
    required String codeVerifier,
  }) async {
    final json = await _client.post(
      '/api/auth/google/complete',
      body: {
        'state': state,
        'code': ?code,
        'error': ?error,
        'codeVerifier': codeVerifier,
      },
    ) as Map<String, Object?>;
    return (
      sessionToken: json['sessionToken'] as String,
      user: UserProfile.fromJson(json['user'] as Map<String, Object?>),
    );
  }

  Future<UserProfile> me() async => UserProfile.fromJson(
    await _client.get('/api/auth/me') as Map<String, Object?>,
  );

  Future<void> deleteSession() => _client.delete('/api/auth/session');

  Future<void> setThemePreference(ThemePreference preference) => _client.patch(
    '/api/auth/preferences',
    body: {'themePreference': preference.name},
  );
}
