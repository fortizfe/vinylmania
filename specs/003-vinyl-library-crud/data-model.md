# Data Model: Vinyl Library CRUD

## LibraryEntry (persisted)

Stored at Firestore path `users/{uid}/libraryEntries/{entryId}` (spec Key
Entities: Library Entry). `entryId` is a Firestore auto-generated ID;
ownership is implicit in the path (see research.md §1).

| Field | Type | Required | Notes |
|---|---|---|---|
| `discogsReleaseId` | number | yes | The Discogs release this entry represents. Verified to exist at creation time (research.md §5). Immutable after creation — changing which release an entry points to is not supported; remove and re-add instead. |
| `addedAt` | timestamp | yes | Set once, at creation. Never updated. |
| `condition` | string | no | Free-form, but the frontend offers the standard collector grading scale (Mint, Near Mint, Very Good Plus, Good, Fair, Poor) as suggestions. Not sourced from Discogs. |
| `notes` | string | no | Free-form personal text. Not sourced from Discogs. |

**Validation rules**:
- `discogsReleaseId` MUST be a positive integer corresponding to a release
  that exists in Discogs at creation time (FR-010); this is checked
  server-side, not merely assumed from the frontend's search/select flow.
- `condition` and `notes`, when present, MUST be non-empty strings within a
  reasonable length (e.g., `notes` capped at ~2000 characters) to prevent
  unbounded writes; enforcement detail (exact cap) belongs to
  implementation, not this data model.
- No field on `LibraryEntry` MUST ever duplicate catalog data obtainable
  from Discogs (FR-007) — anything about the release itself lives only in
  Discogs and is fetched live (see `EnrichedLibraryEntry` below).

**State transitions**: A `LibraryEntry` has no lifecycle/status field — it
exists from creation until deletion. `condition`/`notes` may be updated any
number of times; `discogsReleaseId` and `addedAt` never change after
creation.

## EnrichedLibraryEntry (API response shape, not persisted)

What the backend actually returns from the library list/detail endpoints —
a `LibraryEntry` merged with live Discogs data (research.md §2, §4). This is
a response shape, not a Firestore document.

| Field | Type | Required | Notes |
|---|---|---|---|
| `id` | string | yes | The `LibraryEntry`'s Firestore document ID. |
| `discogsReleaseId` | number | yes | Passed through from the persisted entry. |
| `addedAt` | string (ISO 8601) | yes | Passed through from the persisted entry. |
| `condition` | string | no | Passed through from the persisted entry. |
| `notes` | string | no | Passed through from the persisted entry. |
| `catalogStatus` | `'ok' \| 'unavailable'` | yes | Whether the live Discogs fetch for this entry succeeded (research.md §4). |
| `release` | `Release \| null` | yes | The feature 002 `Release` shape (see `specs/002-discogs-api-client/data-model.md`) when `catalogStatus` is `'ok'`; `null` when `'unavailable'`. |

**Relationships**:
- Each `LibraryEntry` belongs to exactly one `User` (feature 001), via the
  Firestore path it lives under — never shared or queryable across users
  (spec FR-006).
- Each `LibraryEntry` references exactly one Discogs `Release` (feature
  002's entity) by ID, but does not own or duplicate its data — the
  relationship is a live lookup, not a stored copy.
- A `Release` may be referenced by more than one `LibraryEntry` belonging to
  the same user (spec FR-008: owning duplicate physical copies) or to
  different users entirely (two collectors can each have their own entry
  pointing at the same Discogs release).
