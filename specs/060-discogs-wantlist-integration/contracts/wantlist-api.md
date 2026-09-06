# Contract: `/api/wantlist` HTTP API

All routes require `requireAuth` (Firebase session) and the `standard` rate-limit tier
(same as `/api/library`). All routes require a linked Discogs account; an unlinked or
revoked link is reported with the shared gate contract below. `{username}` is resolved
server-side from the caller's stored `DiscogsConnection` — never taken from the client.

Base path mounted in `backend/src/app.ts`: `app.use('/api/wantlist', wantlistRouter)`
(added after `/api/library`).

---

## Shared error contract (identical to `/api/library`, see `contracts/library-sync-api.md` of feature 016)

| Condition | Status | Body |
|-----------|--------|------|
| No Discogs account linked | `409` | `{ "error": "discogs_not_linked", "message": "Link your Discogs account to use your wishlist." }` |
| Discogs rejected stored credentials (revoked link) | `401` | `{ "error": "discogs_link_invalid", "message": "Your Discogs link is no longer valid. Please re-link your account from your profile." }` |
| Discogs rate-limited (429, retries exhausted) | `429` | `{ "error": "discogs_rate_limited", "message": "Discogs is receiving too many requests right now. Please try again in a moment." }` |
| Discogs unavailable / circuit open / network | `503` | `{ "error": "discogs_unavailable", "message": "Discogs is temporarily unavailable. Please try again later." }` |
| Invalid request body / params | `400` | `{ "error": "invalid_request", "message": "..." }` |
| Unexpected | `500` | `{ "error": "internal_error", "message": "Something went wrong. Please try again." }` |

Implemented by a shared `respondCollectionError(res, route, uid, err)` extracted from
`libraryRoutes.ts` into `backend/src/adapters/discogs/respondCollectionError.ts` and
used by both routers.

---

## `GET /api/wantlist`

List the caller's wantlist, synchronized with Discogs (sync-on-read, ~5-min cache).

**Query params**

| Param | Type | Default | Notes |
|-------|------|---------|-------|
| `page` | int ≥ 1 | `1` | |
| `pageSize` | int 1..50 | `20` | |
| `refresh` | `"true"` | — | Forces a fresh Discogs sync (invalidates `discogs:wantlist:{uid}` first). |

**200 response**

```jsonc
{
  "items": [
    {
      "discogsReleaseId": 123456,
      "rating": 4,
      "notes": "Original pressing only",
      "addedAt": "2025-08-01T19:00:00.000Z",
      "catalogStatus": "ok",
      "release": { /* feature 002 Release; release.community.rating drives the badge */ }
    },
    {
      "discogsReleaseId": 777,
      "rating": 0,
      "notes": null,
      "addedAt": "2025-07-15T10:00:00.000Z",
      "catalogStatus": "unavailable",
      "release": null
    }
  ],
  "page": 1,
  "pageSize": 20,
  "totalItems": 2
}
```

- Items are ordered newest-first by `addedAt`.
- `totalItems` is the full wantlist size (from the cached array), not the page length.
- An empty wantlist returns `{ "items": [], "page": 1, "pageSize": 20, "totalItems": 0 }` (the frontend renders the empty state — FR-004).
- Within the cache window this route issues **zero** Discogs requests (SC-008).

**Logs**: `sync_started` / `sync_skipped` / `sync_completed` with `uid`, `meta: { totalItems }`.

---

## `POST /api/wantlist`

Add a release to the caller's Discogs wantlist. Idempotent.

**Body** (`strict`)

```json
{ "discogsReleaseId": 123456 }
```

**201 response** — `EnrichedWantEntry` + two flags:

```jsonc
{
  "discogsReleaseId": 123456,
  "rating": 0,
  "notes": null,
  "addedAt": "2026-09-06T12:00:00.000Z",
  "catalogStatus": "ok",
  "release": { /* ... */ },
  "alreadyInWantlist": false,
  "alreadyInLibrary": true
}
```

- `alreadyInWantlist: true` ⇒ the release was already a want; no duplicate created, entry returned unchanged (FR-007).
- `alreadyInLibrary: true` ⇒ the caller owns this release (authoritative check via the collection endpoint). The library is **not** modified (FR-007a). The frontend surfaces "already in your library" in the action result.
- `404` `{ "error": "release_not_found", "message": "No release found in the catalog for that ID." }` — the catalog lookup that gates the add failed with 404 (mirrors `POST /api/library`).
- Busts `discogs:wantlist:{uid}`.

**Logs**: `entry_added` with `uid`, `meta: { releaseId, alreadyInWantlist, alreadyInLibrary }`.

---

## `GET /api/wantlist/:releaseId`

Single-entry lookup for the release detail page's wantlist panel.

- `:releaseId` — positive integer.
- **200**: `{ "discogsReleaseId": 123456, "rating": 4, "notes": "...", "addedAt": "..." }`
- **404**: `{ "error": "not_in_wantlist", "message": "This release is not in your wishlist." }`
- May be served from the `discogs:wantlist:{uid}` cache when warm; otherwise one `GET /wants` sync.

---

## `PATCH /api/wantlist/:releaseId`

Update one field of a wantlist entry (per-field autosave — FR-009).

**Body** (`strict`, ≥ 1 key)

```jsonc
{ "rating": 5 }         // OR
{ "notes": "Repress is fine after all" }
```

| Field | Validation |
|-------|------------|
| `rating` | int `0..5` (`0` clears) |
| `notes` | string (`""` clears) |

- **200**: updated `WantEntryDetail` (`{ discogsReleaseId, rating, notes, addedAt }`).
- **404** `{ "error": "not_in_wantlist", ... }` when the release is not a want.
- **400** `invalid_request` when the body is empty or a value is out of range.
- Maps to `PUT /users/{username}/wants/{releaseId}` with only the provided field.
- Busts `discogs:wantlist:{uid}`.
- On a Discogs write failure the entry is **not** reported as saved (FR-017) — the error contract above applies and the frontend keeps the field in its pre-save state with a retry affordance.

**Logs**: `entry_updated` with `uid`, `meta: { releaseId, fields: ["rating"] }`.

---

## `DELETE /api/wantlist/:releaseId`

Explicit removal from the wantlist (the frontend gates this behind a confirmation
dialog — FR-011; the backend performs the removal unconditionally when called).

- **204** on success.
- **404** `{ "error": "not_in_wantlist", "message": "This release is not in your wishlist." }` when the release is not a want (Discogs `DELETE` returned 404).
- Busts `discogs:wantlist:{uid}`.

**Logs**: `entry_removed` with `uid`, `meta: { releaseId }`.

---

## MODIFIED: `POST /api/library` (201) response

Adds one optional field (backward-compatible):

```jsonc
{
  "id": "…", "discogsReleaseId": 123456, "addedAt": "…",
  "catalogStatus": "ok", "release": { /* … */ }, "discogs": { /* … */ },
  "wantlistRemoval": "removed"        // "removed" | "not_in_wantlist" | "failed" | (absent)
}
```

- `"removed"` — the release was in the wantlist and was removed (FR-012).
- `"not_in_wantlist"` — nothing to remove; no error.
- `"failed"` — the library add succeeded but the wantlist removal failed; the frontend
  shows a non-blocking notice "Added to your library. We couldn't remove it from your
  wishlist — remove it there when you can." (FR-013). The library add is **not** rolled
  back and is **not** reported as failed.

**Logs**: `wantlist_removed_on_purchase` (info) or `wantlist_removal_failed` (warn) with `uid`, `meta: { releaseId }`.
