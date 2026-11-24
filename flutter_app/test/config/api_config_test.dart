import 'package:flutter_test/flutter_test.dart';
import 'package:vinylmania/config/api_config.dart';

void main() {
  test('a release build without API_BASE_URL fails fast', () {
    expect(
      () => ensureApiBaseUrlConfigured(release: true, defined: false),
      throwsStateError,
    );
  });

  test('debug builds may fall back to localhost; defined URLs pass', () {
    ensureApiBaseUrlConfigured(release: false, defined: false);
    ensureApiBaseUrlConfigured(release: true, defined: true);
  });
}
