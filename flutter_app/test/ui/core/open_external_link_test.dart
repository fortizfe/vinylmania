import 'package:flutter_test/flutter_test.dart';
import 'package:vinylmania/ui/core/open_external_link.dart';

void main() {
  test('delegates to the replaceable launcher', () async {
    final opened = <Uri>[];
    final original = launchExternalUrl;
    launchExternalUrl = (uri) async {
      opened.add(uri);
      return true;
    };
    addTearDown(() => launchExternalUrl = original);

    await openExternalLink(Uri.parse('https://example.com/a'));

    expect(opened, [Uri.parse('https://example.com/a')]);
  });

  test('opens only http and https links', () async {
    final opened = <Uri>[];
    final original = launchExternalUrl;
    launchExternalUrl = (uri) async {
      opened.add(uri);
      return true;
    };
    addTearDown(() => launchExternalUrl = original);

    for (final link in [
      'intent://scan/#Intent;scheme=zxing;end',
      'file:///etc/passwd',
      'tel:+34600000000',
      'vinylmania://auth/callback?code=x',
      'javascript:alert(1)',
      '/relative/path',
    ]) {
      await openExternalLink(Uri.parse(link));
    }
    await openExternalLink(Uri.parse('http://example.com/b'));

    expect(opened, [Uri.parse('http://example.com/b')]);
  });
}
