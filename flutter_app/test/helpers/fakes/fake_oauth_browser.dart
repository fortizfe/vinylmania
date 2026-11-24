import 'package:vinylmania/data/services/oauth_browser.dart';

/// Returns [result] (null = user closed the browser) or throws [error];
/// records every URL it was asked to open.
class FakeOAuthBrowser implements OAuthBrowser {
  FakeOAuthBrowser({this.result, this.error});

  Uri? result;
  Object? error;
  final List<Uri> requested = [];

  @override
  Future<Uri?> authenticate(Uri url) async {
    requested.add(url);
    if (error != null) throw error!;
    return result;
  }
}
