# Data Model: Header Search Redesign — Instant Suggestions (069)

No persistent storage changes. Firestore is not touched: a suggestion is a projection of a Discogs catalog search, held only in the Redis cache (5 min) and in the TanStack Query cache.

## 1. Glossary (closes the `album` / `release` / `master` / `artist` ambiguity left Outstanding at clarify)

| Term | What it is | Discogs `type` / domain `resultType` | Where it goes |
|---|---|---|---|
| **release** | One specific edition of a record — a pressing, with its own catalogue number, country, year and format. | `release` | `/app/releases/:discogsId` |
| **master** | Discogs' grouping of every edition of the same work. Discogs indexes a work **once**: as a master when it has sibling versions, as a release otherwise. | `master` | `/app/masters/:discogsId` |
| **album** | The **collector-facing word for either of the two above.** It is the word used in all UI copy ("Album"), in the spec's "up to 3 albums", and in the quota rule below. It is **not** a wire field and **not** a domain type — `resultType ∈ {release, master}` *is* "album". | `release` \| `master` | as above, per `resultType` |
| **artist** | A Discogs artist hit. The app has no artist screen (spec Assumptions, FR-012), so it opens the full results for that name. | `artist` | `/app/search?q=<name>` via `buildSearchPath` |

Rule of thumb for every artifact in this feature: **"album" in prose and UI copy, `resultType` in code and on the wire.**

## 2. `CatalogSuggestion` (new domain type, `backend/src/domain/discogsCatalog/types.ts`)

The narrow projection of `CatalogSearchResult` that a suggestion panel needs. It is the wire shape of `GET /api/discogs/suggest` (see [contracts/suggest-api.md](./contracts/suggest-api.md)) and the shape cached in Redis.

| Field | Type | Required | Source (`CatalogSearchResult`) | Validation / notes |
|---|---|---|---|---|
| `discogsId` | `number` | yes | `discogsId` | Identifies the destination. |
| `resultType` | `'release' \| 'master' \| 'artist'` | yes | `resultType` | Carries both the visible kind label and the destination (§1). The only kind discriminator — there is no `kind` field (research D17). |
| `title` | `string` | yes | `title` | Primary label. For `release`/`master` the mapper has already split `"Artist - Title"`; for `artist` it is the artist name verbatim. |
| `artist` | `string` | no | `artist` | Secondary detail for albums. Absent on artist rows and on album rows whose raw title had no separator. |
| `year` | `number` | no | `year` | Secondary detail. Omitted when Discogs gives none or a non-numeric value (existing mapper behaviour). |
| `format` | `string` | no | `formats[0]` | **First** format only — the panel has one line for it. Omitted when `formats` is absent or empty. |
| `thumbnailUrl` | `string` | no | `thumbnailUrl` | `cover_image` then `thumb`, existing mapper precedence. Rendered as a passive `<img>` (Principle IX carve-out). |

Deliberately **not** carried: `communityRating` (the whole point of the separate endpoint — no rating fan-out), `country`, `labels`, `formats[1..]`, pagination.

## 3. Slot allocation — "up to 2 artists + up to 3 albums, cross-filled to 5" (`backend/src/domain/discogsCatalog/suggestionQuota.ts`)

Input: the mapped hits of **one** upstream search, in the order Discogs returned them.

1. **Partition**, preserving Discogs order: `artists` = hits with `resultType === 'artist'`; `albums` = hits with `resultType ∈ {release, master}`. Anything else is already dropped by the adapter.
2. **Base allowance**: `artists.slice(0, 2)` and `albums.slice(0, 3)`.
3. **Cross-fill**: while the total is below `5`, take the next unused hit from whichever list still has one — albums first, then artists (an album row is the more informative row, and the artist allowance is the smaller one).
4. **Output order**: the taken artists (Discogs order) first, then the taken albums (Discogs order). Stable and independent of how the cross-fill ran.

Truth table (the backend unit table; `A` = artists available, `B` = albums available):

| A | B | artists taken | albums taken | total |
|---|---|---|---|---|
| ≥2 | ≥3 | 2 | 3 | 5 |
| 0 | ≥5 | 0 | 5 | 5 |
| 1 | ≥4 | 1 | 4 | 5 |
| ≥2 | 1 | 4 | 1 | 5 |
| ≥5 | 0 | 5 | 0 | 5 |
| 1 | 1 | 1 | 1 | 2 |
| 0 | 0 | 0 | 0 | 0 |
| ≥2 | 2 | 3 | 2 | 5 |

Invariants, asserted directly: output length `= min(5, A + B)`; never more than 5; every element is present in the input; no duplicates; the rule is a **pure function of the input list** (same input → same output, no clock, no randomness), which is what makes SC-011's "a query whose matches are all of one kind still fills the panel to 5 when 5 matches exist" testable without Discogs.

## 4. Suggestion request (client-side state, `HeaderSearchBox`)

The spec's "Suggestion request" entity is not a wire object — it is the state that decides what the panel may display (FR-013).

| State | Type | Notes |
|---|---|---|
| `value` | `string` | What is in the field right now. Pre-filled from `useSearchQueryParams().query` on the results screen (FR-004). |
| `debounced` | `string` | `value` after a 300 ms pause (FR-010, research D9). |
| `hasEdited` | `boolean` | False until the first `onChange` after activation; cleared on collapse. Gates the lookup so activation alone never opens the panel (FR-004, clarification 4). |
| *lookup key* | derived | `debounced.trim()`. The lookup runs when `hasEdited && key.length >= 2`. |

**Staleness is structural, not managed**: the TanStack Query key is the lookup key, so a response for a superseded query lands in its own cache entry and the component never reads it (FR-013, SC-005). There is no request id, no sequence counter and no abort (research D8).

## 5. Panel state machine

One derived state, not stored — `HeaderSuggestionPanel` renders from the query result plus the two flags above.

```text
                     field emptied / search collapsed
        ┌──────────────────────────────────────────────────┐
        │                                                  │
   ┌────┴───┐  edit, ≥2 chars,     ┌─────────┐  ≥1 hit  ┌──▼──────────┐
   │  idle  ├──── 300 ms pause ───►│ loading ├─────────►│ suggestions │
   └────┬───┘                      └────┬────┘          └─────────────┘
        │                               │  0 hits       ┌─────────────┐
        │  <2 chars / not yet edited    ├──────────────►│    empty    │
        │  (no lookup, no panel)        │               └─────────────┘
        │                               │  request failed  ┌──────────┐
        └───────────────────────────────┴─────────────────►│  error   │
                                                           └────┬─────┘
                                                    Retry ──────┘ (→ loading)
```

| State | Trigger | Panel renders | Announced (polite) |
|---|---|---|---|
| `idle` | fewer than 2 non-whitespace chars, or not yet edited since activation | nothing — the panel is not mounted, `aria-expanded="false"` | region cleared |
| `loading` | lookup in flight | 5 skeleton rows, same shape and height as real rows (FR-014, SC-008) | "Searching…" |
| `suggestions` | 1–5 results | the `<li role="option">` rows | "N suggestions available." / "1 suggestion available." |
| `empty` | 0 results | empty-state text naming the searched text + how to broaden (FR-018) | "No suggestions for “<query>”." |
| `error` | request rejected | error text + a "Retry" button (FR-019) | "Suggestions are unavailable. Retry is available." |

Transitions out of every state: emptying the field, or collapsing the search, returns to `idle` and **clears the announcement region** (FR-015). Consecutive failures replace the message — the state is a single value, so nothing can stack (FR-019). A session-expired rejection is not an `error` state: `authorizedFetch` already clears the session and the app's existing sign-in handling takes over (spec edge case).

Every state shares the panel's width and row height, so the panel never resizes between states (SC-008, Constitution "No layout shift").
