import '../../domain/models/discogs/discogs_connection_status.dart';
import '../../domain/api_exception.dart';
import '../services/discogs_oauth_api.dart';
import '../services/oauth_browser.dart';
import '../../domain/models/discogs/discogs_link_outcome.dart';

/// The user's Discogs account link. [status] and [disconnect] throw
/// `ApiException`; [link] always resolves to an outcome.
class DiscogsConnectionRepository {
  DiscogsConnectionRepository({
    required this._api,
    required this._oauthBrowser,
  });

  final DiscogsOauthApi _api;
  final OAuthBrowser _oauthBrowser;

  Future<DiscogsConnectionStatus> status() => _api.status();

  /// request (client native) → system auth session → complete. Mirrors the
  /// web's DiscogsCallbackPage: a closed browser or a missing token/verifier
  /// (Discogs' `denied`) is `denied`; `expired_request` is `expired`.
  Future<DiscogsLinkOutcome> link() async {
    try {
      final callback = await _oauthBrowser.authenticate(await _api.request());
      final oauthToken = callback?.queryParameters['oauth_token'];
      final oauthVerifier = callback?.queryParameters['oauth_verifier'];
      if (oauthToken == null || oauthVerifier == null) {
        return DiscogsLinkOutcome.denied;
      }
      await _api.complete(oauthToken: oauthToken, oauthVerifier: oauthVerifier);
      return DiscogsLinkOutcome.linked;
    } on ApiException catch (e) {
      return e.code == 'expired_request'
          ? DiscogsLinkOutcome.expired
          : DiscogsLinkOutcome.error;
    } on Exception {
      return DiscogsLinkOutcome.error;
    }
  }

  Future<void> disconnect() => _api.disconnect();
}
