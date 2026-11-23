---
name: flutter-platforms
description: Platform layer of the Vinylmania Flutter app — creating the project, running and building for Android, iOS, macOS, Windows and Linux, per-platform native config (manifests, Info.plist, entitlements, deep links / OAuth callback, secure storage requirements, network permissions), CI for flutter_app/, versioning with the release script, and signing/store prerequisites. Use when touching flutter_app/{android,ios,macos,windows,linux}/, pubspec.yaml platform setup, build or CI config, or when something works on one platform and not another.
---

# Flutter platforms — Vinylmania

Targets: **Android, iOS, macOS, Windows, Linux**. Dart code stays
platform-agnostic (`flutter-architecture`); platform differences live in the
native folders and, when Dart must branch, in one place behind a class in
`lib/data/services/` — never `Platform.isX` scattered across widgets.

## Create (once)

```bash
flutter create --platforms=android,ios,macos,windows,linux \
  --org <reverse-domain> --project-name vinylmania flutter_app
```

`--org` fixes the bundle/application id forever in the stores — the user
decides it before the first commit. Then delete the counter demo, add
`flutter_lints`, and commit the generated native folders (no `build/`, no
`.dart_tool/`, no `local.properties`, no keystores).

## Run

```bash
cd flutter_app
flutter run -d macos   --dart-define=API_BASE_URL=http://localhost:3001
flutter run -d <android-emulator> --dart-define=API_BASE_URL=http://10.0.2.2:3001
flutter devices                       # list targets
```

iOS/macOS builds need macOS + Xcode; Windows builds need Windows; Linux builds
need Linux (or CI runners for each). `flutter doctor -v` first when a build fails.

## Native config checklist (each is a classic "works on X, not on Y")

| Platform | Must have |
|---|---|
| Android | `<uses-permission android:name="android.permission.INTERNET"/>` in **`src/main`** manifest (flutter create only adds it to debug/profile); `minSdk` high enough for `flutter_secure_storage`; deep-link `intent-filter` for the auth callback (App Links with `autoVerify` once the domain is decided); cleartext only for the dev host via `network_security_config`. |
| iOS | URL scheme / Associated Domains for the auth callback; ATS stays on — dev `http` only via `NSAllowsLocalNetworking`; usage strings only for permissions actually used. |
| macOS | `com.apple.security.network.client` in **both** `DebugProfile.entitlements` and `Release.entitlements` (sandbox blocks all networking otherwise); Keychain access for secure storage; sensible minimum window size. |
| Windows | Loopback redirect for the auth callback; nothing else special for http/storage. |
| Linux | `libsecret-1-dev` (build) / `libsecret` (runtime) for secure storage; loopback redirect for the auth callback. |

## Auth callback (needs backend + architect)

Mobile: deep link (`<scheme>://auth/callback` or a verified https link).
Desktop: `http://127.0.0.1:<port>/callback` loopback. `flutter_web_auth_2`
handles both. The backend's Google/Discogs OAuth redirect URIs must accept the
native ones — that is a backend change (`backend-agent`) designed in a spec by
`architect-agent`; don't hack it client-side.

## CI (`.github/workflows/ci.yml`)

First job, when `flutter_app/` exists: `subosito/flutter-action` (stable,
cached) on `ubuntu-latest` → `flutter pub get` → `dart format --set-exit-if-changed .`
→ `flutter analyze` → `flutter test`. Platform build matrix (macOS runner for
iOS/macOS, Windows runner) only when there is something to release — YAGNI
until then. Keep `actionlint` green.

## Versioning

Backend and frontend are versioned in lockstep by `scripts/release/run-release.js`
from conventional commits. The app's `pubspec.yaml` `version: x.y.z+build` must
join the lockstep: extend the release script (test-first, `scripts/__tests__`)
in the same PR that creates `flutter_app/`. `build` number = monotonic CI run
number, never hand-edited.

## Signing & stores (when the first release is planned, not before)

Android upload keystore + `key.properties` (gitignored, CI secrets); Apple team,
certificates and provisioning via Xcode/App Store Connect; Windows MSIX signing
certificate; Linux packaging format (Flatpak/Snap/AppImage) is a product
decision. Secrets never enter the repo or the chat.
