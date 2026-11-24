import 'package:flutter/services.dart';
import 'package:flutter_web_auth_2/flutter_web_auth_2.dart';

/// Opens an OAuth URL in the system auth session and waits for the
/// `vinylmania://` callback.
class OAuthBrowser {
  const OAuthBrowser();

  /// Returns the callback URI, or null when the user closed the browser.
  // ponytail: custom scheme works on Android/iOS/macOS only; Windows/Linux need a loopback http://127.0.0.1:<port> relay target.
  Future<Uri?> authenticate(Uri url) async {
    try {
      final callback = await FlutterWebAuth2.authenticate(
        url: url.toString(),
        callbackUrlScheme: 'vinylmania',
      );
      return Uri.parse(callback);
    } on PlatformException catch (e) {
      if (e.code == 'CANCELED') return null;
      rethrow;
    }
  }
}
