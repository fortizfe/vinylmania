import 'dart:convert';

import 'package:http/http.dart' as http;

import '../../config/api_config.dart';
import '../../domain/api_exception.dart';
import 'session_storage.dart';

/// The only door to our backend: base URL, Bearer token, JSON and error
/// mapping. Knows no endpoint.
class ApiClient {
  ApiClient({
    required this._httpClient,
    required this._sessionStorage,
    this._baseUrl = apiBaseUrl,
  });

  final http.Client _httpClient;
  final SessionStorage _sessionStorage;
  final String _baseUrl;

  /// Set by AuthRepository. Called on 401 unless the error is
  /// `discogs_link_invalid` (the Discogs link failed, not our session).
  void Function()? onUnauthorized;

  /// Query values: `String`, or `Iterable<String>` for repeated keys.
  Future<Object?> get(String path, {Map<String, Object>? query}) =>
      _send('GET', path, query: query);

  Future<Object?> post(String path, {Object? body}) =>
      _send('POST', path, body: body);

  Future<Object?> patch(String path, {Object? body}) =>
      _send('PATCH', path, body: body);

  Future<void> delete(String path) => _send('DELETE', path);

  Future<Object?> _send(
    String method,
    String path, {
    Map<String, Object>? query,
    Object? body,
  }) async {
    var uri = Uri.parse('$_baseUrl$path');
    if (query != null && query.isNotEmpty) {
      uri = uri.replace(queryParameters: query);
    }
    final request = http.Request(method, uri)
      ..headers['Accept'] = 'application/json';
    if (body != null) {
      request.headers['Content-Type'] = 'application/json';
      request.body = jsonEncode(body);
    }

    final http.Response response;
    try {
      final token = await _sessionStorage.readToken();
      if (token != null) request.headers['Authorization'] = 'Bearer $token';
      response = await _httpClient
          .send(request)
          .then(http.Response.fromStream)
          .timeout(_timeout);
    } on Exception {
      throw const ApiException(
        0,
        'network_error',
        'Could not reach Vinylmania. Check your connection and try again.',
      );
    }

    final status = response.statusCode;
    final decoded = _decode(response);
    if (status >= 200 && status < 300) {
      if (status == 204 || response.bodyBytes.isEmpty) return null;
      if (identical(decoded, _malformed)) {
        throw ApiException(status, 'unknown', 'Request failed');
      }
      return decoded;
    }

    final error = decoded is Map ? decoded['error'] : null;
    final message = decoded is Map ? decoded['message'] : null;
    final code = error is String ? error : 'unknown';
    if (status == 401 && code != 'discogs_link_invalid') {
      await _sessionStorage.clear();
      onUnauthorized?.call();
    }
    throw ApiException(
      status,
      code,
      message is String ? message : 'Request failed',
    );
  }

  static const _timeout = Duration(seconds: 30);
  static const _malformed = Object();

  static Object? _decode(http.Response response) {
    if (response.bodyBytes.isEmpty) return null;
    try {
      return jsonDecode(utf8.decode(response.bodyBytes));
    } on FormatException {
      return _malformed;
    }
  }
}
