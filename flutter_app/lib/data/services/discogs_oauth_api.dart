import '../../domain/models/discogs/discogs_connection_status.dart';
import 'api_client.dart';

/// `/api/discogs/oauth/*` calls (account link).
class DiscogsOauthApi {
  DiscogsOauthApi(this._client);

  final ApiClient _client;

  Future<DiscogsConnectionStatus> status() async =>
      DiscogsConnectionStatus.fromJson(
        await _client.get('/api/discogs/oauth/status') as Map<String, Object?>,
      );

  /// Starts a native link; the backend relays Discogs back to
  /// `vinylmania://discogs/callback`.
  Future<Uri> request() async {
    final body = await _client.post(
      '/api/discogs/oauth/request',
      body: {'client': 'native'},
    ) as Map<String, Object?>;
    return Uri.parse(body['authorizeUrl'] as String);
  }

  Future<DiscogsConnectionStatus> complete({
    required String oauthToken,
    required String oauthVerifier,
  }) async => DiscogsConnectionStatus.fromJson(
    await _client.post(
      '/api/discogs/oauth/complete',
      body: {'oauthToken': oauthToken, 'oauthVerifier': oauthVerifier},
    ) as Map<String, Object?>,
  );

  Future<void> disconnect() => _client.delete('/api/discogs/oauth/connection');
}
