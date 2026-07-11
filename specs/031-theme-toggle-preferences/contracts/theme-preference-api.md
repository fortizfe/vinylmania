# API Contract: Theme Preference

**Feature**: 031-theme-toggle-preferences | **Base path**: `/api/auth` (existing `authRouter`, `backend/src/routes/auth.ts`)

All endpoints require `Authorization: Bearer <Firebase ID token>` (existing `requireAuth` middleware). Unauthenticated requests receive the standard `401 { "error": "unauthorized", "message": "Sign-in required or session expired." }`. All error bodies follow the project-wide `{ "error": <code>, "message": <user-safe text> }` shape; internal details go to structured logs only (Principle V).

---

## PATCH /api/auth/preferences

Sets the signed-in user's explicit theme preference (FR-005). Writes only the `themePreference` field on `users/{uid}` — never any other profile field.

**Request body** (zod-validated):

```json
{ "themePreference": "light" | "dark" }
```

**Responses**:

| Status | Body | When |
|---|---|---|
| 200 | Full `UserProfile` (see below), including the updated `themePreference` | Preference saved |
| 400 | `{ "error": "validation_error", "message": "The preference value is not valid." }` | Body fails validation (missing field, or value other than `"light"`/`"dark"`) |
| 401 | `{ "error": "unauthorized", "message": "Sign-in required or session expired." }` | Missing/invalid bearer token |
| 500 | `{ "error": "internal_error", "message": "Something went wrong. Please try again." }` | Firestore write failure, including the defensive case where `users/{uid}` does not exist (should not happen post-session — this route is only ever reachable after `POST /api/auth/session` has created the document) |

**Log events**: `outcome: "preference_saved"` (info, uid + value) / `outcome: "preference_save_failed"` (error, uid + cause) — mirrors the existing `authRouter` `{ route, outcome, uid, message }` shape (Principle V). The frontend uses a failed response (after its own retry attempts, FR-010) to trigger the FR-011 non-blocking notification.

**Idempotent**: yes — setting the same value twice is a no-op write with the same 200 response.

---

## Existing endpoints: response shape extended

No new read endpoint is introduced. `POST /api/auth/session` and `GET /api/auth/me` now include the optional `themePreference` field in their existing `UserProfile` response body:

```json
{
  "uid": "abc123",
  "displayName": "Jane Collector",
  "email": "jane@example.com",
  "photoURL": "https://...",
  "createdAt": "2026-01-01T00:00:00.000Z",
  "lastSignInAt": "2026-07-11T00:00:00.000Z",
  "themePreference": "dark"
}
```

`themePreference` is **absent** (not `null`) in the JSON body when the user has never set an explicit preference — the frontend MUST treat both "absent" and "explicitly null" the same way (fall back to OS `prefers-color-scheme`, FR-007).

**Contract test MUST assert**: `PATCH /api/auth/preferences` rejects any value other than the two allowed strings with `400`; a value written by one call is the exact value returned by a subsequent `GET /api/auth/me`; no other `UserProfile` field is altered by a preferences-only write.
