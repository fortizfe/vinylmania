# Port Contract: `DiscogsCatalogPort`

**Feature**: 047-discogs-catalog-hexagonal-migration | **Layer**: `ports/discogsCatalog/discogsCatalogPort.ts`
**Adapter**: `adapters/discogsCatalog/discogsCatalogAdapter.ts` (wraps `axios` directly, plus the unmoved `discogsRateLimiter.ts`/`discogsCircuitBreaker.ts`/`discogsRetry.ts`/`discogsErrors.ts`, and the relocated `discogsMapper.ts`)

Signatures are a direct extraction of `discogsClient.ts`'s current exported
functions — no behavior change, only the dependency direction (application code
depends on this interface, never on `axios` directly) and one narrowing:
`searchCatalog` here is **raw** (no rating enrichment) — see
`research.md` Decision 2 for why enrichment is an application-layer concern with its
own cache-wrap, not part of this port.

```ts
export interface DiscogsCatalogPort {
  getRelease(discogsReleaseId: number): Promise<Release>;

  getArtist(discogsArtistId: number): Promise<Artist>;

  /** A Discogs master release group's detail (feature 026, US3). */
  getMasterRelease(masterId: number): Promise<MasterRelease>;

  /** One page of a master's version list, 10 per page by default. */
  getMasterReleaseVersions(
    masterId: number,
    page?: number,
    perPage?: number,
  ): Promise<MasterReleaseVersionsPage>;

  /** One release's community rating; rejects if the lookup fails or exceeds its own short timeout. */
  getReleaseRating(discogsReleaseId: number): Promise<CommunityRating>;

  /** Raw catalog search — no rating enrichment; see application/discogsCatalog/searchCatalogWithRatings.ts. */
  searchCatalog(
    query: string,
    options?: SearchCatalogOptions,
  ): Promise<CatalogSearchResponse>;
}

export interface SearchCatalogOptions {
  resultType?: 'release' | 'artist';
  page?: number;
  perPage?: number;
  genre?: string;
  style?: string;
  format?: string;
}
```

## Preconditions / Postconditions (unchanged from today's `discogsClient.ts`)

- `searchCatalog`: an empty/whitespace-only `query` returns an empty result set
  without an HTTP call, exactly as today. Filter values are trimmed; blank values are
  treated as unset. A `release`-scoped search additionally keeps Discogs' own
  `master`-type hits alongside `release`-type hits (the two are indexed as one thing
  by Discogs — feature 026 research.md §1) and drops any other raw hit type.
- `getReleaseRating`: uses its own short lookup budget and is deliberately excluded
  from the retry/circuit-breaker policy (fail-soft/fast) — this semantic distinction
  MUST be preserved by the adapter, but the specific mechanism (an axios-only request
  option) MUST NOT leak into this port's signature.
- Every method may reject with a `DiscogsError` subclass (`not_found`/`rate_limited`/
  `unavailable`/`auth_failed`), exactly as `discogsClient.ts` throws them today —
  unchanged, still imported from the unmoved `discogs/discogsErrors.ts`.

## Explicitly out of this port's surface

Rate-limit smoothing, circuit-breaker state, and retry/backoff scheduling are entirely
internal to the adapter (delegated to the unmoved `discogsRateLimiter.ts`/
`discogsCircuitBreaker.ts`/`discogsRetry.ts`) and are not exposed here. Caching is not
part of this port's own contract either — five of the six methods above are cached
*inside* the adapter via the injected `CachePort`; `searchCatalog` itself is
deliberately **not** cached at this layer (its caller caches the enriched result — see
`cache-port.md` and `research.md` Decision 2).
