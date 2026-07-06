# API Contract: Library ⇄ Discogs Collection Sync

**Feature**: 016-library-discogs-sync | **Date**: 2026-07-06

All endpoints live under `/api/library`, require Firebase auth (`Authorization: Bearer <idToken>`, existing `requireAuth`), and additionally require an active Discogs connection. **BREAKING** changes vs. feature 010's contract are marked.

## Common error responses

| Status | Body `error` | When |
|---|---|---|
| 401 | `unauthorized` | Missing/invalid Firebase token (existing behavior) |
| 409 | `discogs_not_linked` | No Discogs connection for this user. Message: "Link your Discogs account to use your library." |
| 401 | `discogs_link_invalid` | Discogs rejected the stored credentials (revoked externally). Message: "Your Discogs link is no longer valid. Please re-link your account from your profile." |
| 429 | `discogs_rate_limited` | Discogs 429 passthrough |
| 502 | `catalog_unavailable` | Catalog (unauthenticated) Discogs failure — existing |
| 503 | `discogs_unavailable` | Collection (authenticated) Discogs failure |
| 500 | `internal_error` | Anything else |

Every error body: `{ "error": string, "message": string }` (user-safe message; details go to logs).

## Shared shape: `EnrichedLibraryEntry` (**BREAKING**: `condition`/`notes` removed, `discogs` added)

```jsonc
{
  "id": "fs-entry-id",
  "discogsReleaseId": 130076,
  "addedAt": "2026-07-06T10:00:00.000Z",
  "catalogStatus": "ok",            // or "unavailable"
  "release": { /* existing Release shape or null */ },
  "discogs": {
    "instanceId": 987654,
    "folderId": 1,
    "rating": 4,                     // 0–5, 0 = unrated
    "mediaCondition": "Very Good Plus (VG+)",   // or null
    "sleeveCondition": "Near Mint (NM or M-)",  // or null
    "notes": "First pressing.",                 // or null
    "editable": { "mediaCondition": true, "sleeveCondition": true, "notes": true }
  }
}
```

`discogs` is present on every entry returned after a successful sync. In list responses only, `discogs` MAY be `null` for an entry whose instance data could not be resolved this pass (the detail endpoint then re-resolves or errors).

## GET /api/library?page&pageSize[&refresh=true]

Synchronizes with the Discogs collection (skipped when the 5-minute throttle marker is fresh; `refresh=true` forces it), then returns the mirrored, enriched page.

- 200: `{ "items": EnrichedLibraryEntry[], "page": 1, "pageSize": 20, "totalItems": 42 }`
- First sync for a connection also performs the union merge + legacy migration (research R3) before responding.
- 409 `discogs_not_linked` / 401 `discogs_link_invalid` / 503 `discogs_unavailable` when sync cannot run at all. A sync that fails *mid-pass* leaves previously mirrored entries intact and returns 503 rather than a partial silent result.

## GET /api/library/:id

Returns one enriched entry including fresh per-copy `discogs` data (fetched via Collection Items By Release for the managed instance; no full-collection sync).

- 200: `EnrichedLibraryEntry`
- 404 `entry_not_found` | 409 `discogs_not_linked` | 401 `discogs_link_invalid` | 503 `discogs_unavailable`

## POST /api/library (**BREAKING**: `condition`/`notes` no longer accepted)

Body: `{ "discogsReleaseId": 130076 }` (zod-validated; unknown keys rejected with 400 `invalid_request`).

Write-through order: add to Discogs collection folder 1 → record returned `instance_id` → create mirror entry → 201. Any Discogs failure aborts before the mirror is touched (FR-011).

- 201: `EnrichedLibraryEntry`
- 400 `invalid_request` | 404 `release_not_found` | 409 `discogs_not_linked` | 401 `discogs_link_invalid` | 429 | 503

## PATCH /api/library/:id (**BREAKING**: body is now Discogs per-copy fields)

Body (zod-validated, at least one key):

```jsonc
{
  "rating": 4,                                  // optional, integer 0–5
  "mediaCondition": "Very Good Plus (VG+)",     // optional, member of MEDIA_CONDITIONS or null to clear
  "sleeveCondition": "Generic",                 // optional, member of SLEEVE_CONDITIONS or null to clear
  "notes": "New note"                           // optional, string (empty string clears)
}
```

Each provided field is written to Discogs (rating via instance POST; the rest via the fields endpoint). Designed for per-field autosave: the frontend sends one field per call. Response reflects the post-write state.

- 200: `EnrichedLibraryEntry`
- 400 `invalid_request` (bad rating range, condition not in grading set, or targeting a field whose `editable` flag is false)
- 404 `entry_not_found` | 409 `discogs_not_linked` | 401 `discogs_link_invalid` | 429 | 503

## DELETE /api/library/:id

Write-through order: delete managed instance from Discogs → delete mirror entry → 204. If Discogs deletion fails, the entry is untouched and an error returned. If Discogs reports the instance already gone (404), the mirror entry is deleted anyway (converged state).

- 204 on success
- 404 `entry_not_found` | 409 `discogs_not_linked` | 401 `discogs_link_invalid` | 429 | 503

## Frontend consumption notes

- `libraryApi.ts` / `libraryQueries.ts` adopt the new shapes; mutations become per-field (`useUpdateLibraryEntry` sends exactly one changed field per invocation).
- On `discogs_not_linked` the library page renders the `LibraryLinkRequired` card (CTA → `/app/profile`); on `discogs_link_invalid` the re-link variant. Both must be distinguishable from generic errors via the `error` code, so `apiClient` must surface response bodies for non-2xx.
- A "Refresh" action on the library page calls the list endpoint with `refresh=true` and replaces the cached query result.

## Discogs upstream contract (stubbed in tests)

The collection client (research R4) is the only consumer of the authenticated Discogs endpoints listed in research R4's table. Contract tests stub these with nock at `DISCOGS_OAUTH_BASE_URL`; e2e uses the same env override to point at the local Discogs stub.
