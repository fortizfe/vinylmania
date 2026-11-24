import 'dart:convert';
import 'dart:math';

import 'package:crypto/crypto.dart';

const _charset =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';

/// PKCE pair (RFC 7636, S256). [verifier] is injectable for tests only.
({String verifier, String challenge}) createPkcePair({String? verifier}) {
  final random = Random.secure();
  final v =
      verifier ??
      String.fromCharCodes(
        List.generate(64, (_) => _charset.codeUnitAt(random.nextInt(66))),
      );
  final digest = sha256.convert(ascii.encode(v)).bytes;
  return (verifier: v, challenge: base64Url.encode(digest).replaceAll('=', ''));
}
