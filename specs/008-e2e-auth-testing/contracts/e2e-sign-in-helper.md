# Contract: Fake Google Sign-In Helper

This feature has no new HTTP API surface — the backend's existing
`POST /api/auth/session` / `GET /api/auth/me` contracts (see feature
001's [auth-api.md](../../001-landing-google-login/contracts/auth-api.md))
are exercised unchanged, as real requests, by the flow below. The one new
interface this feature adds is a shared test helper that every e2e spec file
depends on to trigger a simulated Google sign-in. This is the boundary Phase 2
tasks must implement against.

## `signInAsFakeGoogleUser(page, options?)`

**Location**: `e2e/helpers/fakeGoogleSignIn.ts` (or equivalent within the new
`e2e/` project — exact filename is a Phase 2 task decision).

**Preconditions**:
- `page` has already navigated to the running frontend app, which has been
  started with the Auth-emulator opt-in flag set (data-model.md §2).
- The Firebase Auth emulator is running and reachable at the host/port the
  frontend was configured with.

**Behavior contract**:
1. Locates and clicks the app's real "Sign in with Google" control — the
   same DOM element a human user would click. It MUST NOT call any internal
   React state setter or mock to shortcut this step.
2. Waits for the resulting popup window (the emulator's fake identity-provider
   page, not a real Google URL).
3. Drives that popup's "Add new account" fixture flow using the identity
   fields in `options` (falling back to scenario-appropriate defaults — see
   data-model.md §1), then confirms.
4. Waits for the popup to close and for the host page to reach the
   authenticated state (i.e., the same visible signal a human tester uses
   today per [quickstart.md](../../001-landing-google-login/quickstart.md)'s
   manual validation step 2).

**Postconditions**:
- The app is showing the authenticated view, backed by a real session
  established via a real `POST /api/auth/session` call.
- Returns (or the caller can otherwise obtain) the identity fields used, so
  assertions can check the displayed name/photo match.

**Failure mode**: If any step above does not complete within the suite's
standard timeout, the helper MUST reject with an error that names which step
failed (popup never appeared / popup never closed / authenticated state never
appeared) — never a bare generic timeout — so a broken login surfaces as a
specific, actionable failure (spec Edge Cases, Acceptance Scenario 4 of User
Story 1).

**Non-goals**: This helper does not stub, mock, or bypass any part of the
production sign-in code path (`AuthContext.tsx`, `/api/auth/session`,
`/api/auth/me`). Its only interaction with test infrastructure is that the
identity provider it talks to is the local emulator's fixture screen instead
of real Google — everything downstream of that is the real app.
