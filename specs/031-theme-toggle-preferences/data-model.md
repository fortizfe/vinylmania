# Data Model: Theme Preference Toggle & Dark Mode Polish

**Feature**: 031-theme-toggle-preferences | **Date**: 2026-07-11

Storage: Firestore via Firebase Admin SDK (backend-only writes). Extends the existing `users/{uid}` document — no new collection (research.md R2). Backward compatible / additive only (MINOR per Principle VI).

## Entity: Theme Preference (field on the existing `users/{uid}` document)

| Field | Type | Required | Description / Validation |
|---|---|---|---|
| `themePreference` | `'light' \| 'dark'` (optional) | no (field absent/undefined when unset) | The user's explicit theme choice. An absent/undefined field means no explicit choice has ever been made — the app falls back to the OS `prefers-color-scheme` setting (FR-007). The field is never written as an explicit `null`; it is simply omitted until set. Any value other than `'light'`/`'dark'` MUST be rejected by the write endpoint (400) and MUST NOT be persisted. |

Extends the existing `UserProfile` interface in `backend/src/services/userService.ts`:

```ts
export interface UserProfile {
  uid: string;
  displayName: string;
  email: string;
  photoURL?: string;
  createdAt: string;
  lastSignInAt: string;
  themePreference?: 'light' | 'dark'; // NEW — absent = no explicit preference
}
```

**Lifecycle / state transitions**:

```
(absent) --user activates toggle--> 'light' | 'dark'
'light' --user activates toggle--> 'dark'
'dark'  --user activates toggle--> 'light'
```

There is no path back to "absent" once a user has made an explicit choice (FR-008: the explicit preference always takes precedence over the OS setting from then on). This is a deliberate scope boundary for this increment (see spec.md Assumptions) — reintroducing an "automatic" state is a Suggested Enhancement, out of scope here.

**Relationships**: 1:1 with `users/{uid}` — a field on the existing document, not a separate entity. Only the authenticated owner (`req.auth.uid` from the verified Firebase ID token, never a client-supplied uid) may write their own `themePreference`, mirroring the existing `authRouter` authorization pattern.

**Mutated by**: `PATCH /api/auth/preferences` (see [contracts/theme-preference-api.md](./contracts/theme-preference-api.md)).

**Read by**: The existing `POST /api/auth/session` and `GET /api/auth/me` responses, once `UserProfile` is extended — no new read endpoint required.

## Client-only concept: Local Theme Cache (not part of Firestore)

Not a Firestore entity — a `localStorage` entry used purely as a performance/UX optimization (research.md R3). Documented here because it participates in the same state machine from the client's point of view.

| Key | Value | Written by | Authoritative? |
|---|---|---|---|
| `vinylmania:theme-preference` | `'light' \| 'dark'` | Inline bootstrap script (on first resolution) and the frontend `ThemeProvider` (on every toggle and on every successful Firestore reconciliation) | No — always overwritten by the Firestore-sourced value once it loads; used only to avoid a visible flash before that value arrives (FR-015) |

**Reconciliation rule**: If the cached value and the Firestore-sourced value differ once the account's data has loaded, the Firestore value wins and the cache is updated to match. The cache is never sent to the server and never treated as more authoritative than Firestore.

## Notes on scope boundaries carried over from spec.md

- Only two explicit values exist (`'light'`, `'dark'`); no third "automatic" value is modeled in this increment (see Assumptions in spec.md).
- No history/audit trail of preference changes is modeled — the field is overwritten in place, consistent with it being simple UI state rather than a business record.
