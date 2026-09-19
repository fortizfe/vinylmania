# Data Model: Library Redesign — Sort & Infinite Scroll (068)

## 1. `LibraryEntry` (Firestore `users/{uid}/libraryEntries/{id}`, domain `backend/src/domain/library/types.ts`)

| Field | Change | Notes |
|---|---|---|
| `title?: string` | **NEW** | Album title from the Discogs collection row's `basic_information.title`. It is written by `syncLibrary` → `persistCollectionFacets` on every non-skipped sync, only when the value is non-empty after `trim()`, and never cleared. |
| `primaryArtist?: string` | unchanged (feature 061) | Sort key for `artist`. |
| `addedAt: string` (ISO) | unchanged | Sort key for `added`; tie-break key. |
| `id: string` | unchanged | Final, unique tie-break. |

- **Backfill / migration**: additive optional field. The existing sync is the backfill, and an entry without `title` follows the missing-last rule (§3). Rollback = ignore the field; no script is needed (Principle VI: MINOR).
- **API**: the listing already spreads the entry, so `title` appears in `GET /api/library` items (additive). The frontend keeps rendering `release.title`.
- `PaginatedLibraryEntries` (domain) is deleted with `repository.listEntries` if nothing else references it.

## 2. `LibrarySort` (new domain type, `backend/src/domain/library/types.ts`)

```text
LibrarySort = { criterion: 'added' | 'artist' | 'album', direction: 'asc' | 'desc' }
DEFAULT_LIBRARY_SORT = { criterion: 'added', direction: 'desc' }
```

| Input (`sort`, `dir`) | Result |
|---|---|
| absent / unknown `sort` | criterion `added` |
| valid `sort`, `dir` ∈ {asc, desc} | as given |
| valid `sort`, `dir` absent / unknown | `added` → `desc`; `artist`/`album` → `asc` |

The same table applies in the frontend (`useLibraryQueryParams`) and the backend (`parseLibrarySort` in `libraryRoutes.ts`). Neither ever errors.

## 3. Sort key derivation & ordering (`backend/src/domain/library/librarySort.ts`)

**Key normalisation** (`artist` ← `primaryArtist`, `album` ← `title`):
1. `undefined` → missing.
2. `trim()`; an empty result → missing.
3. Strip one leading article: `/^(the|a|an|el|la|los|las|die|les)\s+(?=\S)/i` → `''`. "The" alone stays "The"; "The Clash" → "Clash"; "Los Suaves" → "Suaves".
4. Compare with `Intl.Collator('en', { sensitivity: 'base', numeric: true })`. This makes case and diacritics equal ("Motörhead" = "Motorhead", "ac/dc" ≈ "AC/DC") and numbers natural.

**Ordering** — records are split into *present* (key exists) and *missing*; present always precede missing, in both directions.

| Criterion | Present group, in order | Missing group |
|---|---|---|
| `added` | `addedAt` (dir) → `id` asc | n/a (`addedAt` always exists) |
| `artist` | artistKey (dir) → albumKey asc (missing album last) → `addedAt` desc → `id` asc | `addedAt` desc → `id` asc |
| `album` | albumKey (dir) → artistKey asc (missing artist last) → `addedAt` desc → `id` asc | `addedAt` desc → `id` asc |

Only the primary key follows `dir`; secondary keys are fixed. That makes the order a pure function of `(entries, sort)`, so batch boundaries can never duplicate or skip a record (FR-005, SC-007).

## 4. List pipeline (`listLibraryEntries`)

```text
syncLibrary(uid, {force})                       # unchanged, marker-throttled
all      = repository.listAllEntries(uid)
matched  = all.filter(matchesLibraryFilters)    # unchanged rule
sorted   = sortLibraryEntries(matched, sort)
items    = sorted.slice((page-1)*pageSize, page*pageSize)
enriched = enrichLibraryEntry.enrichEntries(uid, items)   # unchanged
→ { enriched, page, pageSize, totalItems: matched.length }
```

## 5. Library view state (frontend)

| Piece | Lives in | Lifetime |
|---|---|---|
| `sort` (criterion + direction) | URL `?sort=&dir=` | shareable; bare `/app/library` = default |
| `genre` / `style` / `format` | URL (existing `catalogFilterParams`) | shareable |
| view mode | `localStorage` `vinylmania:view-mode:library` (existing) | per device |
| loaded batches | TanStack infinite query, key `['library','list', sort, filters]` | session (gcTime) |
| panel open | component state in `LibraryToolbar` | transient; closed on breakpoint change |
| `from` (return path) | router `location.state` on the detail page | that history entry |

### URL transitions

| Action | From | To | List |
|---|---|---|---|
| Pick a sort (select or radio) | `/app/library?genre=Rock` | `/app/library?sort=artist&dir=asc&genre=Rock` | restart at batch 1, scroll to top |
| Pick "Newest first" | `…?sort=artist&dir=asc&genre=Rock` | `/app/library?genre=Rock` (defaults omitted) | restart |
| Toggle a filter (live) | `…?sort=album&dir=desc` | `…?sort=album&dir=desc&style=Doom+Metal` | restart |
| Clear all filters | `…?sort=album&dir=desc&genre=Rock` | `…?sort=album&dir=desc` | restart |
| Refresh | unchanged | unchanged | batch 1 replaced with a forced sync |
| Scroll near end | unchanged | unchanged | append next batch |
| Open record | `/app/library?…` | `/app/library/records/:id` with `state.from = "/app/library?…"` | cached |
| Back / delete on detail | detail | `state.from ?? "/app/library"` | cached pages re-render; stale ones refetch |
| Legacy link | `/app/library?page=3&genre=Rock` | same URL, `page` ignored | batch 1 |

**Pending user confirmation (see the decision note in tasks.md):** sort, filter and clear changes use `navigate(path, { replace: true })` by default. With live apply, one push per checkbox tick would bury the previous page under a stack of history entries. The address still always reflects the current state (FR-006), and the detail page's Back uses `state.from`, not history.
