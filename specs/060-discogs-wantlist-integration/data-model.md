# Phase 1 Data Model: Discogs-Integrated Wantlist

No new persistent store. Every entity below is either an in-memory/API shape or a
projection of the user's **Discogs wantlist** (`/users/{username}/wants`). Firestore
is not touched by this feature.

---

## 1. `WantItem` (raw Discogs shape) — `backend/src/domain/discogsOauth/wantlistTypes.ts`

The normalized projection of one element of the Discogs `wants` array. Produced by
`discogsWantlistAdapter`, consumed by the `wantlist` application layer.

| Field | Type | Source / rules |
|-------|------|----------------|
| `releaseId` | `number` | Discogs `id` (== `basic_information.id`). The wantlist key. |
| `rating` | `number` | `0..5` integer. `0` = unrated. Personal, per-entry. |
| `notes` | `string \| null` | Free text; `null`/`''` normalized to `null`. |
| `dateAdded` | `string` | ISO-8601, from `date_added`. Used for newest-first ordering. |
| `basicInformation` | `{ title: string; year: number \| null; artists: { name: string }[]; thumb: string \| null }` | Fallback label data when catalog enrichment fails. |

---

## 2. `EnrichedWantEntry` (API + application shape) — `backend/src/domain/discogsOauth/wantlistTypes.ts`

What `/api/wantlist` returns per entry. `WantItem` + catalog data.

| Field | Type | Rules |
|-------|------|-------|
| `discogsReleaseId` | `number` | From `WantItem.releaseId`. |
| `rating` | `number` | Personal rating, `0..5`. Mirrors `WantItem.rating`. |
| `notes` | `string \| null` | Mirrors `WantItem.notes`. |
| `addedAt` | `string` | ISO-8601, from `WantItem.dateAdded`. |
| `catalogStatus` | `'ok' \| 'unavailable'` | `'unavailable'` when the per-release catalog lookup failed; the rest of the list still renders (Principle VII). |
| `release` | `Release \| null` | Full catalog release (feature 002 `Release` type). `null` when `catalogStatus === 'unavailable'`. Carries `community.rating` → the **community** rating badge. |

**Derived, not stored**: the card's badge value = `presentRating(release.community?.rating)` (existing `frontend/src/lib/releaseRating.ts`). The personal `rating` is rendered as a separate `StarRating`, never in the badge (spec FR-003, FR-010).

---

## 3. `WantEntryDetail` — single-entry response for the detail page

`GET /api/wantlist/:releaseId` → `200` with:

| Field | Type | Rules |
|-------|------|-------|
| `discogsReleaseId` | `number` | Path param echoed. |
| `rating` | `number` | `0..5`. |
| `notes` | `string \| null` | — |
| `addedAt` | `string` | ISO-8601. |

`404` (`{ error: 'not_in_wantlist' }`) when the release is not in the user's wantlist.
No catalog enrichment here — the detail page already loaded the `Release` from the
catalog endpoint.

---

## 4. `UpdateWantEntryPatch` — `PATCH /api/wantlist/:releaseId` body

One field per call (per-field autosave, FR-009). `strict`, at least one key:

| Field | Type | Validation |
|-------|------|------------|
| `rating` | `number?` | integer `0..5` (`0` clears the rating) |
| `notes` | `string?` | any string (`''` clears the note) |

Maps to `PUT /users/{username}/wants/{releaseId}` with only the provided field.

---

## 5. `AddToWantlistResult` — `POST /api/wantlist` (201) response

`EnrichedWantEntry` **plus**:

| Field | Type | Rules |
|-------|------|-------|
| `alreadyInWantlist` | `boolean` | `true` when the release was already a want before this call (idempotent add — no duplicate created, FR-007). |
| `alreadyInLibrary` | `boolean` | `true` when `discogsCollection.getInstancesForRelease` is non-empty (FR-007a). The library is **not** modified. |

---

## 6. `LibraryEntry` creation result — MODIFIED

`POST /api/library` (201) response gains one optional field (backward-compatible, MINOR):

| Field | Type | Rules |
|-------|------|-------|
| `wantlistRemoval` | `'removed' \| 'not_in_wantlist' \| 'failed'` (optional) | Outcome of the automatic wantlist removal on purchase (FR-012/FR-013). Absent when the connection had no wantlist interaction path (should not happen for a linked user) — treat absent as "no action". |

Frontend shows a non-blocking warning only for `'failed'`.

---

## 7. Cache entries (Redis, via `cacheAdapter`) — ephemeral

| Key | Value | TTL | Invalidated by |
|-----|-------|-----|----------------|
| `discogs:wantlist:{uid}` | JSON array of `EnrichedWantEntry` (full wantlist, newest-first) | 300 s | `addToWantlist`, `updateWantEntry`, `removeFromWantlist`, purchase-removal in `createLibraryEntry`, and `GET /api/wantlist?refresh=true` |

Reuses existing per-release catalog caches (feature 011) for enrichment. No new cache
key naming module — the single key is defined inline in `application/wantlist` (mirrors
`syncLibrary.ts`'s `syncMarkerKey`).

---

## 8. State transitions

```text
(not in wantlist) --PUT /wants--> (in wantlist, rating 0, notes null)
(in wantlist) --PATCH rating/notes--> (in wantlist, updated field)   [per-field, autosaved]
(in wantlist) --DELETE /wants (explicit, confirmed)--> (not in wantlist)
(in wantlist) --POST /api/library for same release--> (in library) AND (removed from wantlist)   [FR-012]
(in wantlist) --deleted on discogs.com--> (not in wantlist, disappears on next fresh sync)   [FR-018]
```

Invariant (FR-012): after a successful "add to library" for a release, that release is
not simultaneously in the library and the wantlist — unless the wantlist removal
failed, in which case the user is told (`wantlistRemoval: 'failed'`).

Non-invariant (FR-007a): adding to the wantlist a release already in the library is
allowed — the two can briefly coexist by explicit user choice; only the purchase
direction auto-reconciles.

---

## 9. Validation rules summary

| Rule | Where enforced |
|------|----------------|
| `rating` ∈ integer `0..5` | `zod` schema on `POST`/`PATCH` bodies; adapter clamps defensively |
| `releaseId` ∈ positive integer | `zod` on `POST` body / route param parse |
| `notes` is a string | `zod`; `null`↔`''` normalization in the adapter mapper |
| At least one field on `PATCH` | `zod` `.strict().refine(len>0)` (mirrors `patchBodySchema` in `libraryRoutes.ts`) |
| Unlinked user → gate, no data | `requireConnection` throws `DiscogsNotLinkedError` → `409 discogs_not_linked` |
| Revoked link → relink gate | adapter throws `DiscogsAuthError` → `401 discogs_link_invalid` |
