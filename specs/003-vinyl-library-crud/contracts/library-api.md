# Contract: Library & Discogs-search API (backend)

All endpoints below require the same authentication as the existing
`/api/auth/*` routes: `Authorization: Bearer <firebase-id-token>`, verified
by the existing `requireAuth` middleware. Every library endpoint operates
only on the calling user's own entries (`req.auth.uid`); there is no way to
address another user's data through these paths.

Error responses follow the existing shape from feature 001/002:
`{ "error": "<code>", "message": "<safe, generic message>" }`, with internal
detail logged server-side only (Principle V).

## GET /api/discogs/search

Thin, authenticated proxy onto feature 002's `searchCatalog()`
(research.md §8). Used by the "add a record" flow.

**Query params**: `q` (required), `type` (`release` or `artist`, required).

**Response 200**: Same shape as feature 002's `CatalogSearchResponse`
(see `specs/002-discogs-api-client/contracts/discogs-client.md`).

**Response 401**: Missing/invalid token.

**Response 502** (`error: "catalog_unavailable"`): Discogs is unreachable or
rate-limited — distinguished from a 500 so the frontend can show a
"catalog service unavailable" message rather than a generic error.

## POST /api/library

Creates a new `LibraryEntry` for the caller after verifying the release
exists in Discogs (research.md §5; FR-010).

**Request body**: `{ "discogsReleaseId": number, "condition"?: string, "notes"?: string }`

**Response 201**: The created entry as an `EnrichedLibraryEntry` (see
data-model.md), with `catalogStatus: 'ok'` (verification already succeeded).

**Response 404** (`error: "release_not_found"`): No such release in
Discogs — nothing is written.

**Response 502** (`error: "catalog_unavailable"`): Discogs couldn't be
reached to verify the release — nothing is written; the caller should
retry.

## GET /api/library

Lists the caller's `LibraryEntry` records, enriched with live Discogs data
(research.md §3, §4).

**Query params**: `page` (default `1`), `pageSize` (default `20`, max `50`).

**Response 200**:
```json
{
  "items": [ /* EnrichedLibraryEntry[] */ ],
  "page": 1,
  "pageSize": 20,
  "totalItems": 42
}
```
Individual items may have `catalogStatus: 'unavailable'` and `release:
null` (FR-009) without affecting the rest of the response or its 200 status.

## GET /api/library/:id

Returns a single `EnrichedLibraryEntry` owned by the caller.

**Response 200**: `EnrichedLibraryEntry`.

**Response 404** (`error: "entry_not_found"`): No such entry for this
caller (either it never existed or belongs to someone else — both look
identical to the caller, per FR-006's isolation guarantee).

## PATCH /api/library/:id

Updates `condition` and/or `notes` on an entry owned by the caller.
`discogsReleaseId` and `addedAt` are immutable and not accepted here.

**Request body**: `{ "condition"?: string, "notes"?: string }` (at least
one field).

**Response 200**: The updated `EnrichedLibraryEntry`.

**Response 404** (`error: "entry_not_found"`): Same as GET `/api/library/:id`.

## DELETE /api/library/:id

Permanently removes an entry owned by the caller.

**Response 204**: No content.

**Response 404** (`error: "entry_not_found"`): Already removed or never
existed for this caller — treated as a safe, idempotent outcome by the
frontend (see spec edge case: double-submitted delete), not a hard failure.

## Observability requirements (Principle V)

Every request to these endpoints MUST be logged with at least: `route`,
`outcome` (`success` / `not_found` / `unauthorized` / `catalog_unavailable` /
`error`), and the caller's `uid` — sufficient to answer "who did what to
their library, and did it succeed" without a debugger. Per-entry
enrichment failures during `GET /api/library` are logged individually
(entry ID + cause) even though the overall request still returns 200.
