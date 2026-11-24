import 'package:flutter/foundation.dart';

/// Backend base URL, set per build with `--dart-define=API_BASE_URL=…`.
/// The Android emulator reaches the host as `http://10.0.2.2:3001`.
const apiBaseUrl = String.fromEnvironment(
  'API_BASE_URL',
  defaultValue: 'http://localhost:3001',
);

/// Release builds must name their backend: the localhost default is for
/// debug only. Called once at startup.
void ensureApiBaseUrlConfigured({
  bool release = kReleaseMode,
  bool defined = const bool.hasEnvironment('API_BASE_URL'),
}) {
  if (release && !defined) {
    throw StateError(
      'API_BASE_URL is required in release builds: '
      'pass --dart-define=API_BASE_URL=https://…',
    );
  }
}
