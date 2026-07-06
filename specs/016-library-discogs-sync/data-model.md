# Data Model: Sync Vinyl Library with Discogs Collection

**Feature**: 016-library-discogs-sync | **Date**: 2026-07-06

Design references: [research.md](./research.md) (R1, R3, R5, R6, R8), [contracts/library-sync-api.md](./contracts/library-sync-api.md).

## Entity overview

```text
users/{uid}/libraryEntries/{entryId}   (Firestore — membership mirror)
        │  discogsReleaseId
        │  discogsInstanceId ──────────┐
        ▼                              ▼
Release (Discogs catalog, cached)   Collection Instance (Discogs — source of truth
                                     for rating / conditions / notes)
discogsConnections/{uid}  (Firestore — OAuth tokens + initialLibrarySyncAt)
```

## 1. LibraryEntry (Firestore: `users/{uid}/libraryEntries/{entryId}`) — CHANGED

| Field | Type | Notes |
|---|---|---|
| `discogsReleaseId` | number | Unchanged. Release this copy is an instance of. |
| `addedAt` | Timestamp | Unchanged. For Discogs-originated entries, set from the instance's `date_added`. |
| `discogsInstanceId` | number | **NEW.** The managed Discogs collection instance (lowest `instance_id` for the release, per R8). Required on all synced entries. |
| `discogsFolderId` | number | **NEW.** Folder currently holding the managed instance (needed for delete/rating/fields URLs). Updated on each sync. |
| `condition` | string | **REMOVED** (legacy). Deleted per entry after confirmed migration to Discogs (R3). May transiently exist on entries whose migration hasn't completed. |
| `notes` | string | **REMOVED** (legacy). Same lifecycle as `condition`. |

**Validation / invariants**:
- At most one entry per `discogsReleaseId` per user (sync reconciles by release ID).
- An entry without `discogsInstanceId` is legal only before the user's first sync completes; mirror-mode sync must backfill or remove it.
- Entry deletion is legitimate only after Discogs confirms instance removal, or when mirror-mode sync finds the instance gone.

**State transitions**:
1. *Legacy* (pre-feature: has `condition`/`notes`, no instance ID) → *migrated* (instance ID recorded, legacy fields deleted) during first sync.
2. *Absent* → *created* when sync finds a Discogs instance with no matching entry, or when the user adds a record (write-through).
3. *Present* → *deleted* when the user removes the record (write-through) or mirror-mode sync finds no instances of the release left.

## 2. DiscogsCollectionInstance (Discogs-side; not stored, fetched/written via API)

The per-copy source of truth. Backend type: `collectionTypes.ts`.

| Field | Type | Source / write path |
|---|---|---|
| `releaseId` | number | `basic_information.id` on listing |
| `instanceId` | number | `instance_id` on listing |
| `folderId` | number | `folder_id` on listing |
| `rating` | number 0–5 | Listing; written via instance POST (`rating`), 0 = unrated |
| `mediaCondition` | string (grading enum) | `notes[]` value of the "Media Condition" field; written via fields endpoint |
| `sleeveCondition` | string (grading enum + `Generic`/`Not Graded`/`No Cover`) | "Sleeve Condition" field; same write path |
| `notes` | string | "Notes" field; same write path |
| `dateAdded` | ISO string | `date_added` on listing |

**Validation**: `rating` integer 0–5; condition values must be members of the grading sets in `conditionGrading.ts` (R6) — enforced in the PATCH route via zod before any Discogs call.

## 3. DiscogsConnection (Firestore: `discogsConnections/{uid}`) — EXTENDED

Existing doc from feature 015 (uid, discogsUsername, discogsUserId, accessToken, accessTokenSecret, linkedAt).

| Field | Type | Notes |
|---|---|---|
| `initialLibrarySyncAt` | Timestamp | **NEW, optional.** Set once the first-sync pass (union merge + migration) completes for this connection. Absent ⇒ next sync runs in first-sync mode. Deleted with the doc on disconnect, so relinking re-runs the merge (R3). |

## 4. CollectionFieldMap (Redis: `discogs:fields:{uid}`, TTL 24h)

Resolved from `GET /users/{username}/collection/fields` by matching default names (R5).

| Field | Type |
|---|---|
| `mediaConditionFieldId` | number \| null |
| `sleeveConditionFieldId` | number \| null |
| `notesFieldId` | number \| null |

`null` ⇒ the user deleted that field on discogs.com; the corresponding UI control is disabled.

## 5. Sync throttle marker (Redis: `discogs:libsync:{uid}`, TTL 300s)

Value: ISO timestamp of last completed sync. Presence ⇒ skip sync on library reads; `refresh=true` bypasses and re-sets it. Fail-soft: Redis unavailable ⇒ sync every read (R2, R9).

## 6. API response shape: per-copy data (`discogs` object)

Enriched entries returned by the API replace top-level `condition`/`notes` with:

```ts
interface EntryDiscogsData {
  instanceId: number;
  folderId: number;
  rating: number;            // 0–5, 0 = unrated
  mediaCondition: string | null;
  sleeveCondition: string | null;
  notes: string | null;
  editable: {                // false when the matching custom field is missing
    mediaCondition: boolean;
    sleeveCondition: boolean;
    notes: boolean;
  };
}
```

See [contracts/library-sync-api.md](./contracts/library-sync-api.md) for full request/response contracts.

## 7. Condition grading enums (`conditionGrading.ts`)

- `MEDIA_CONDITIONS`: `Mint (M)`, `Near Mint (NM or M-)`, `Very Good Plus (VG+)`, `Very Good (VG)`, `Good Plus (G+)`, `Good (G)`, `Fair (F)`, `Poor (P)`.
- `SLEEVE_CONDITIONS`: `MEDIA_CONDITIONS` ∪ { `Generic`, `Not Graded`, `No Cover` }.
- `LEGACY_CONDITION_MAP` (migration, R6): `Mint→Mint (M)`, `Near Mint→Near Mint (NM or M-)`, `Very Good Plus→Very Good Plus (VG+)`, `Good→Good (G)`, `Fair→Fair (F)`, `Poor→Poor (P)`; unmapped values are appended to migrated notes as `Condition: <original>`.

## Migration & compatibility summary (constitution VI)

- **Breaking**: Firestore entries lose `condition`/`notes`; API create/update contracts change (see contract doc). Coordinated single-PR deploy; commit flagged `feat!`.
- **Migration path**: lazy, per-user, per-entry; legacy fields deleted only after confirmed Discogs writes; resumable on partial failure (R3). No standalone script and no irreversible bulk operation.
- **Rollback**: entries whose migration hasn't run keep legacy fields untouched; reverting the deploy restores the old read path for them. Migrated entries' data lives in the user's Discogs collection, still owned by the user.
