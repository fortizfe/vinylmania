# Port Contract: `LibraryRepositoryPort`

**Feature**: 046-library-hexagonal-migration | **Layer**: `ports/library/libraryRepositoryPort.ts`
**Adapter**: `adapters/library/firestoreLibraryRepository.ts` (wraps `config/firebase-admin.ts`, unmoved)

Signatures are a direct extraction of `backend/src/library/libraryService.ts`'s current exported
functions — no behavior change, only the dependency direction (application code depends on this
interface, never on `firebase-admin` directly).

```ts
export interface LibraryRepositoryPort {
  createEntry(uid: string, input: CreateLibraryEntryInput): Promise<LibraryEntry>;

  getEntry(uid: string, entryId: string): Promise<LibraryEntry | null>;

  listEntries(uid: string, page: number, pageSize: number): Promise<PaginatedLibraryEntries>;

  /** Every entry, unpaginated — used by syncLibrary's reconciliation and by filtered listing. */
  listAllEntries(uid: string): Promise<LibraryEntry[]>;

  /** Upserts genre/style/format; called only on a successful enrichment lookup. */
  persistCatalogFields(
    uid: string,
    entryId: string,
    fields: { genre: string[]; style: string[]; format: string[] },
  ): Promise<void>;

  /** Points an entry at its managed Discogs collection instance. */
  updateEntryInstance(
    uid: string,
    entryId: string,
    instance: { discogsInstanceId: number; discogsFolderId: number },
  ): Promise<void>;

  /** Removes the pre-016 legacyCondition/legacyNotes fields after a confirmed Discogs write. */
  clearLegacyFields(uid: string, entryId: string): Promise<void>;

  deleteEntry(uid: string, entryId: string): Promise<boolean>;
}
```

## Preconditions / Postconditions (unchanged from today's `libraryService.ts`)

- `createEntry`: `input.discogsReleaseId` required; `addedAt` defaults to the write timestamp when
  omitted. Returns the persisted entry including its generated `id`.
- `getEntry` / `deleteEntry`: return `null` / `false` respectively (not a thrown error) when the
  entry doesn't exist — the application layer decides whether that's a 404.
- `listEntries`: paginated, ordered by `addedAt` descending; `listAllEntries` is the unpaginated
  variant used when the caller needs to filter/reconcile the full mirror in memory.
- `persistCatalogFields` / `updateEntryInstance` / `clearLegacyFields`: partial `set(..., { merge: true })`
  or `update(...)` semantics identical to today — no full-document overwrite.

## Not part of this port

`matchesLibraryFilters` and the filtered/paginated composition (`listEntriesFiltered` today) move to
`application/library/listLibraryEntries.ts`, which calls `listAllEntries()` on this port and applies
the domain filter in application code (research.md Decision 1) — filtering is a business rule, not a
persistence concern.
