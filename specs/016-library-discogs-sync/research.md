# Research: Sync Vinyl Library with Discogs Collection

**Feature**: 016-library-discogs-sync | **Date**: 2026-07-06

All Technical Context unknowns are resolved below. Source material: Discogs User Collection API documentation (provided with the feature request), existing modules from features 002 (catalog client), 011 (Redis cache-aside), and 015 (OAuth link).

## R1. Where library membership lives: keep the Firestore mirror

**Decision**: Keep `users/{uid}/libraryEntries` as a synchronized *membership mirror* of the Discogs collection. Each entry keeps `id`, `discogsReleaseId`, `addedAt` and gains `discogsInstanceId` + `discogsFolderId`; `condition`/`notes` are removed (migrated, then deleted per entry).

**Rationale**: Frontend routing (`/app/library/:entryId`), pagination (`orderBy addedAt` + Firestore `count()`), and the existing enrichment pipeline are all keyed on entry documents. A mirror keeps those working, gives a stable local ID per managed copy, and stores the release→instance mapping needed for every Discogs write (rating, fields, delete all require `instance_id`). Constitution explicitly allows Firebase for "collection membership/ownership" while forbidding it as catalog source of truth.

**Alternatives considered**:
- *Drop Firestore entirely, serve the library straight from the Discogs collection*: removes the mirror-consistency problem but breaks entry-based routes, ordering, and pagination; every page view would depend on Discogs availability; instance mapping would still need to be re-derived constantly. Rejected as a larger breaking change with no user-visible gain.
- *Keep notes/condition in Firestore alongside Discogs*: dual source of truth, explicitly ruled out by the spec (FR-009) and clarification #2.

## R2. Sync trigger and throttling: sync-on-read with a Redis marker

**Decision**: `GET /api/library` runs `syncLibrary(uid)` before listing, guarded by a Redis marker key `discogs:libsync:{uid}` with TTL 300s. If the marker exists, the sync is skipped and cached membership is served. `GET /api/library?refresh=true` ignores and re-sets the marker (forced fresh sync). Write operations (add/remove/per-copy edits) do **not** require a sync; they write through to Discogs and update the mirror directly, so Vinylmania-initiated changes are reflected immediately (FR-014).

**Rationale**: Matches clarification #4 (short cache + manual refresh) with the least machinery: no scheduler, no background jobs. Reuses the existing Redis client; if Redis is unavailable, the marker read fails soft and the sync simply runs on every load — more Discogs calls, still correct (same degradation philosophy as `cacheAside.ts`). A full sync of a 1,000-item collection is ~10 paginated requests (100/page), well inside the 60 req/min authenticated limit.

**Alternatives considered**:
- *Cache the collection payload itself and diff against it*: caching data (not just a "recently synced" fact) risks acting on stale instance IDs after writes; invalidation becomes error-prone. The marker approach caches only the *decision to skip*.
- *Background/scheduled sync*: out of scope per spec assumptions; YAGNI.
- *Frontend-driven sync endpoint (`POST /api/library/sync`)*: an extra round-trip and a second code path; sync-on-read keeps the guarantee "a fresh library load is synced" server-side where it can't be bypassed.

## R3. First-sync detection and legacy data migration

**Decision**: Store `initialLibrarySyncAt` on `discogsConnections/{uid}` (the feature-015 connection doc). When absent, the sync runs in **first-sync mode**: entries missing from Discogs are *added* to the collection (union merge), and each entry's legacy `condition`/`notes` are pushed to the managed instance (notes → Notes field; condition → media condition if it maps to a grading option, otherwise appended verbatim to notes). Only after Discogs confirms the writes for an entry are its legacy fields deleted (`FieldValue.delete()`). `initialLibrarySyncAt` is set only when the first-sync pass completes; per-entry failures leave those entries' legacy fields in place and the flag unset, so the next sync retries them. When the flag is present, sync runs in **mirror mode**: Discogs-only instances create entries, Firestore-only entries are deleted (Discogs is source of truth), nothing is pushed.

**Rationale**: Implements clarifications #1 and #2 exactly. Hanging the flag off the connection doc means disconnect+relink to a *different* Discogs account naturally re-runs the union merge against the new collection (the doc is deleted on disconnect). Per-entry confirmation-before-deletion satisfies FR-010's no-loss guarantee and gives a reversible, resumable migration (constitution VI: documented migration path).

**Alternatives considered**:
- *Global one-shot migration script*: requires operating on all users' tokens at once and a deploy-time coordination step; per-user lazy migration needs no operational step and only touches users who actually load their library.
- *Flag on the user doc*: survives disconnect, which would *wrongly skip* the union merge after relinking a different Discogs account.

## R4. OAuth-signed collection client

**Decision**: New module `backend/src/discogs/collection/collectionClient.ts` making OAuth 1.0a PLAINTEXT-signed requests with the stored access token/secret. `oauthSignature.ts` gains one generic `buildProtectedResourceHeader(credentials, access)` (the existing `buildIdentityHeader` is exactly this; it becomes an alias or is replaced). Base URL comes from `DISCOGS_OAUTH_BASE_URL` (same env override the OAuth flow uses) so e2e/tests can point it at a stub — unlike the catalog client's hardcoded base URL. 401/403 responses map to a new `DiscogsAuthError` in `discogsErrors.ts`; 429 → existing `DiscogsRateLimitError`; 5xx/network → `DiscogsUnavailableError`.

Endpoints used (all authenticated as the collection owner, `username` from the stored connection):

| Operation | Endpoint |
|---|---|
| List collection (all folders) | `GET /users/{username}/collection/folders/0/releases?page={n}&per_page=100` |
| Add release | `POST /users/{username}/collection/folders/1/releases/{release_id}` (folder 1 = Uncategorized) |
| Remove instance | `DELETE /users/{username}/collection/folders/{folder_id}/releases/{release_id}/instances/{instance_id}` |
| Set rating | `POST /users/{username}/collection/folders/{folder_id}/releases/{release_id}/instances/{instance_id}` body `{rating}` |
| List note fields | `GET /users/{username}/collection/fields` |
| Set field value | `POST /users/{username}/collection/folders/{folder_id}/releases/{release_id}/instances/{instance_id}/fields/{field_id}` body `{value}` |

**Rationale**: Collection calls authenticate per-user (token+secret) and can fail with revoked credentials — semantics the app-token catalog client doesn't have, so a separate client keeps error handling honest (SOLID/ISP). Reusing the proven PLAINTEXT signing avoids a second signing implementation.

**Alternatives considered**:
- *Extend `discogsClient.ts` with optional per-request auth*: mixes two auth models and two error taxonomies in one module; every catalog call site would inherit the auth-failure branch it can never hit.
- *HMAC-SHA1 signing*: unnecessary — Discogs documents PLAINTEXT over HTTPS as sufficient, and 015 already ships it.

## R5. Rating and note-field semantics

**Decision**: Rating (0–5 integer) is set via the instance POST endpoint's `rating` parameter; rating 0 = "no rating" (tapping the current star value clears it — resolved here as the deferred low-impact clarification). Media condition, sleeve condition, and notes are values of the collection's *note fields*, edited via the fields endpoint. Field IDs are resolved by fetching `GET /users/{username}/collection/fields` and matching the default field names (`Media Condition`, `Sleeve Condition`, `Notes`); the resolved map is cached per user (Redis, TTL 24h) since Discogs provides no API to create/delete these fields and defaults exist on every account. If a field is missing (user deleted it on the website), that control renders disabled with an explanatory hint rather than failing the whole panel.

**Rationale**: Matches the Discogs API document exactly (Change Rating Of Release, Edit Fields Instance, List Custom Fields). Resolving IDs by name instead of hardcoding 1/2/3 costs one cached request and survives accounts with customized field ordering.

**Alternatives considered**: hardcoding field IDs 1/2/3 — simpler but silently writes the wrong field on any account whose fields were customized; rejected for a data-corruption risk that costs one cached GET to avoid.

## R6. Condition grading options and legacy mapping

**Decision**: The closed grading set used for both media and sleeve condition dropdowns (exact Discogs dropdown values):
`Mint (M)`, `Near Mint (NM or M-)`, `Very Good Plus (VG+)`, `Very Good (VG)`, `Good Plus (G+)`, `Good (G)`, `Fair (F)`, `Poor (P)` — sleeve additionally accepts `Generic`, `Not Graded`, `No Cover`. Legacy Vinylmania values map: `Mint`→`Mint (M)`, `Near Mint`→`Near Mint (NM or M-)`, `Very Good Plus`→`Very Good Plus (VG+)`, `Good`→`Good (G)`, `Fair`→`Fair (F)`, `Poor`→`Poor (P)`. Any other stored value is appended to the migrated notes as `Condition: <original>` (FR-010 no-loss rule). Mapping lives in `conditionGrading.ts` with unit tests.

**Rationale**: Discogs' field endpoint rejects dropdown values that don't match the field's option list, so the UI must submit exact strings. The legacy option list (`MyCopySection.tsx`) is a strict subset modulo suffixes, making the mapping total for UI-created data; the fallback covers hand-entered API values.

## R7. Unlinked-user gate

**Decision**: All library endpoints require an active Discogs connection. Without one they return `409 { error: 'discogs_not_linked', message: … }`. When Discogs rejects stored credentials mid-operation (`DiscogsAuthError`), endpoints return `401 { error: 'discogs_link_invalid', … }`. The frontend maps `discogs_not_linked` to the `LibraryLinkRequired` card (message + CTA to `/app/profile`) and `discogs_link_invalid` to a "re-link your account" variant of the same card. `useDiscogsStatus()` is *not* used as the primary gate — the server-side error is authoritative — but the library page may use it to short-circuit rendering.

**Rationale**: Server-side gating means no code path can mutate a library that isn't backed by a collection (FR-003). 409 (conflict with resource state) distinguishes "never linked" from 401 "credentials no longer valid", mirroring the error-code style of `discogsOauth.ts` (`already_connected` 409, etc.).

## R8. Multiple instances of one release

**Decision**: During sync, when a release appears with several instances, the instance with the lowest `instance_id` (oldest) becomes the managed one recorded on the entry; other instances are ignored — never edited, never deleted. Removing the record from Vinylmania deletes only the managed instance; if other instances remain, the next sync re-creates the entry pointing at the next-oldest instance (correct: the user still owns a copy).

**Rationale**: Spec assumption made concrete and deterministic; `instance_id` is monotonically assigned so "lowest ID" is a stable, order-independent choice.

## R9. Cache invalidation

**Decision**: Add `invalidateCache(key: string)` to `cacheAside.ts` (Redis `DEL`, fail-soft like reads). Add/remove operations and first-sync completion delete `discogs:libsync:{uid}` only when the operation changed membership *outside* the normal write-through path — in practice the marker is left alone on successful write-through (the mirror is already updated) and deleted on partial failures so the next load re-reconciles. The per-user fields map key `discogs:fields:{uid}` is invalidated on disconnect.

**Rationale**: Write-through keeps the mirror correct without a re-sync, honoring "immediate reflection" (FR-014) while the marker keeps discogs.com-side edits on the 5-minute cadence.

## R10. Enrichment source for list/detail views

**Decision**: Keep the existing enrichment pipeline (`getRelease` per entry, cached 6h in Redis). The collection listing's `basic_information` payload is used only for reconciliation (release IDs and instance data), not as a catalog source.

**Rationale**: KISS — the enrichment path, its skeletons, and its `catalogStatus: 'unavailable'` degradation already work and are tested. Introducing a second catalog shape (`basic_information`) would ripple through `Release`-typed components for marginal savings already mitigated by the 6h release cache.

## R11. API/versioning impact

**Decision**: Breaking API change, flagged `feat!` per Conventional Commits: `POST /api/library` accepts only `{ discogsReleaseId }`; `PATCH /api/library/:id` accepts `{ rating?, mediaCondition?, sleeveCondition?, notes? }`; entry responses replace top-level `condition`/`notes` with a `discogs` object (`instanceId`, `folderId`, `rating`, `mediaCondition`, `sleeveCondition`, `notes`). Both packages are pre-1.0, so the breaking change lands as a MINOR bump (backend 0.3.0 → 0.4.0, frontend 0.6.0 → 0.7.0) with `Changed`/`Removed` changelog entries describing the migration (constitution VI: 0.x semver treats minor as the breaking boundary; the documented migration path is R3).

**Rationale**: Frontend and backend deploy together from `main`, so the contract break is coordinated in one PR; the changelog + `!` flag satisfy the constitution's breaking-change visibility requirements.
