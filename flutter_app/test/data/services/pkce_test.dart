import 'package:flutter_test/flutter_test.dart';
import 'package:vinylmania/data/services/pkce.dart';

void main() {
  test('S256 challenge matches the RFC 7636 Appendix B vector', () {
    final pair = createPkcePair(
      verifier: 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk',
    );

    expect(pair.challenge, 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM');
  });

  test('generated verifier is 64 unreserved chars and unique', () {
    final a = createPkcePair();
    final b = createPkcePair();

    expect(a.verifier, matches(RegExp(r'^[A-Za-z0-9\-._~]{64}$')));
    expect(a.challenge, matches(RegExp(r'^[A-Za-z0-9_-]{43}$')));
    expect(a.verifier, isNot(b.verifier));
  });
}
