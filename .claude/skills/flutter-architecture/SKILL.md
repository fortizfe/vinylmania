---
name: flutter-architecture
description: Architecture of the Vinylmania Flutter app (flutter_app/, desktop + Android + iOS) — folder layout, layer responsibilities (View, ViewModel, Repository, Service), the dependency rule, SOLID/KISS/SRP applied to Dart, one class per file, dependency injection, state, networking to our backend only (constitution §IX), session/auth, errors and the approved package list. Use before writing, moving or reviewing any Dart code under flutter_app/lib, when designing a feature for the native app, or when asked "where does this go in Flutter?".
---

# Flutter architecture — Vinylmania

Based on Flutter's official app-architecture guide (MVVM: Views + ViewModels in
the UI layer, Repositories + Services in the data layer), trimmed to what this
app needs. Binding rules: `CONSTITUTION.md` §I, III, IV, IX, X, XI, XII and the
"Native clients" stack entry. The app is a **client of our backend**: it never
re-implements backend business rules and never talks to Discogs, Google or
Firebase for data.

## Layout

```
flutter_app/                     pubspec name: vinylmania
  lib/
    main.dart                    runApp(App(...)) — nothing else
    app/                         composition root: app.dart (MaterialApp.router), router.dart (go_router), dependencies.dart (providers)
    config/                      api_config.dart (API_BASE_URL from --dart-define)
    data/
      services/                  one class per backend resource: library_api.dart, wantlist_api.dart, … + api_client.dart, session_storage.dart
      repositories/              one per domain: library_repository.dart, …
    domain/
      models/                    immutable models, one per file: library_entry.dart, …
      use_cases/                 only when logic spans repositories or is reused by 2+ ViewModels
    ui/
      core/                      theme + shared atomic widgets (see flutter-design)
      <feature>/                 library/, wantlist/, release_detail/, dashboard/, search/, profile/, auth/
        view_models/<x>_view_model.dart
        widgets/<x>_screen.dart, <x>_compact_layout.dart, <x>_expanded_layout.dart, <x>_skeleton.dart, …
  test/                          mirrors lib/
  integration_test/              end-to-end flows on a device/desktop
```

Features mirror the web app's backend domains (`library`, `wantlist`,
`discogsCatalog`, `collectionStats`, `feeds`, `streaming`, `users`, auth).
Don't invent a domain the backend doesn't have.

## Responsibilities (SRP — one reason to change each)

| Class | Owns | Must not |
|---|---|---|
| `ApiClient` (one) | base URL, `Authorization: Bearer <token>`, JSON encode/decode, mapping non-2xx to `ApiException(status, code, message)` using the backend's `{error, message}` body | know any endpoint or model |
| `XxxApi` service | the HTTP calls of one backend resource (`/api/library`, …) ↔ models | cache, hold state, call another service |
| `XxxRepository` | source of truth for one domain: calls its service(s), in-memory cache/invalidation, optimistic updates | touch widgets, `BuildContext`, or HTTP directly |
| `XxxViewModel extends ChangeNotifier` | state of one screen + its user actions (`load()`, `remove(id)`), loading/error/empty | build widgets, call services directly |
| Widgets | render state, forward user intent to the ViewModel | contain business logic, fetch data, read storage |
| Models | immutable data + `fromJson` (+ `toJson` when sent) | depend on Flutter or any package |

## Dependency rule

`ui → domain + data/repositories` · `data/repositories → data/services + domain` ·
`data/services → package:http, plugins` · `domain → nothing` (pure Dart, no `package:flutter`).
Wiring happens only in `lib/app/`. Check (should print nothing):

```bash
cd flutter_app/lib && grep -rnE "import 'package:(flutter|http)/" domain; grep -rn "data/services/" ui
```

## SOLID / KISS in Dart — what it means here

- **DIP without ceremony**: every Dart class is an implicit interface. ViewModels take concrete repositories in the constructor; tests pass `class FakeLibraryRepository implements LibraryRepository`. Write an `abstract interface class` only when a second real implementation exists.
- **ISP**: a ViewModel receives only the repositories it uses — no god `ApiService`, no service locator lookups inside classes.
- **OCP**: new behavior = new widget/class composed in; not a boolean flag on an existing widget.
- **LSP**: fakes honour the real class's contract (same exceptions, same nullability).
- **KISS**: no use case that just forwards to a repository; no `Result`/`Either` wrapper — services throw `ApiException`, ViewModels catch it; no codegen (`freezed`, `json_serializable`) until hand-written `fromJson` becomes the bulk of a PR.

## One class per file (constitution §XII)

One class per file, file named after it in `snake_case`. A `StatefulWidget` and
its private `State` may share a file. A `sealed` hierarchy uses `part` /
`part of` with one subclass per file. Private helper *functions* are fine;
private helper *widgets* get their own file under the feature's `widgets/`.
Check (only StatefulWidget files may print, with 2):

```bash
cd flutter_app/lib && grep -rcE "^(abstract |sealed |final |base |interface |mixin )*class " . | grep -vE ":(0|1)$"
```

## Networking, session, auth

- `API_BASE_URL` via `--dart-define`; Android emulator reaches the host as `10.0.2.2`.
- Session token in `flutter_secure_storage` (Keychain / Keystore / libsecret / DPAPI) behind `SessionStorage` — never `shared_preferences`.
- Login is the same backend-mediated Google OAuth the web uses (`/api/auth/google/start` → provider → `/api/auth/google/complete` with `code` + `state` → session token). Native clients receive the callback through a deep link (mobile) or loopback redirect (desktop) — **this needs backend changes** (per-client redirect URI allow-list) and is an `architect-agent` decision recorded in `specs/`. Same for Discogs account linking. Details per platform: `flutter-platforms` skill.
- 401 from any call → clear the session and route to sign-in, in one place (`ApiClient` + router redirect), not per screen.

## Approved packages

`provider` (DI + `ChangeNotifier` wiring, as in the official guide), `go_router`
(routing, deep links, auth redirect), `http` (+ `package:http/testing.dart`
`MockClient` in tests), `flutter_secure_storage`, `flutter_web_auth_2` (OAuth
callback on every platform), `flutter_lints`. Anything else must climb the
ponytail ladder in the PR description: what the SDK or a few lines can't do.

## Tests (test-first, see `test-first` skill)

- ViewModels and repositories: plain `test()` with hand-written fakes (`implements`).
- Services: `MockClient` asserting method, path, headers and mapping of error bodies to `ApiException`.
- Widgets: `testWidgets` per state (skeleton, empty, error, populated), compact and expanded sizes, plus the built-in a11y guidelines (see `flutter-design`).
- Flows: `integration_test/` with a `MockClient`-backed `ApiClient`; real-backend runs only when a spec needs it.

`flutter analyze` and `dart format --set-exit-if-changed .` must be clean.
