# Contract: Search Rating-Enrichment Concurrency (`backend/src/discogs/discogsClient.ts`)

## `backend/src/shared/concurrency.ts` (RELOCATED from `backend/src/library/concurrency.ts`)

```ts
export async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]>;
```

Implementation and signature are byte-for-byte unchanged from `library/concurrency.ts` — only the
file's location and its two import sites change (`libraryEnrichment.ts` and, newly,
`discogsClient.ts`).

## `searchCatalog()` (MODIFIED)

```ts
const SEARCH_RATING_CONCURRENCY = 5; // matches libraryEnrichment.ts's ENRICHMENT_CONCURRENCY
```

| Before | After |
|---|---|
| `await Promise.all(mappedResults.map(enrichWithRating))` | `await mapWithConcurrency(mappedResults, SEARCH_RATING_CONCURRENCY, enrichWithRating)` |

**Behavior contract**:

| Scenario | Behavior |
|---|---|
| Page has ≤ `SEARCH_RATING_CONCURRENCY` eligible (release/master) results | Identical behavior to today — all enrich in parallel (no observable change). |
| Page has more eligible results than the concurrency limit | At most `SEARCH_RATING_CONCURRENCY` `getReleaseRating`/`getMasterRelease` calls are in flight at once for this search; the rest queue behind the first batch (FR-009). |
| A result is already cache-hit (rating and/or master data within TTL) | `withCache`'s existing single-flight/cache-aside layer resolves it without a real Discogs call — `mapWithConcurrency`'s concurrency slot is held only as long as the (fast, in-process) cache lookup takes, so cached results are unaffected in practice (FR-010). |
| `enrichWithRating` throws or the 2-second rating timeout elapses | Unchanged fail-soft behavior — the `try/catch` inside `enrichWithRating` still catches it and returns the un-enriched result; `mapWithConcurrency`'s worker loop moves on to the next item exactly as `Promise.all` would have (FR-011). |

**Callers**: `searchCatalog()` is the only call site changed. `routes/discogs.ts`'s
`/api/discogs/search` handler is unmodified — same response shape, same error handling.
