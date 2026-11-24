import 'package:flutter/foundation.dart';
import 'package:url_launcher/url_launcher.dart';

/// Test seam: replace to assert which URL a widget opens.
@visibleForTesting
Future<bool> Function(Uri uri) launchExternalUrl = (uri) =>
    launchUrl(uri, mode: LaunchMode.externalApplication);

/// Opens [uri] in the system browser or its app (web `target=_blank`).
/// Only http(s): feed links come from third-party RSS, so `intent:`,
/// `file:`, `tel:` or our own `vinylmania:` scheme are ignored.
Future<void> openExternalLink(Uri uri) async {
  if (uri.isScheme('http') || uri.isScheme('https')) {
    await launchExternalUrl(uri);
  }
}
