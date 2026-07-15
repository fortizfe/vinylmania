# Phase 0 Research: Discogs Catalog Domain Migrated to Hexagonal Architecture

No `NEEDS CLARIFICATION` markers remained in the Technical Context. This feature
operates inside the convention already ratified (Constitution Principle VIII) and
already demonstrated in real code by the library domain (Historia 2). The decisions
below resolve the design choices spec.md explicitly deferred to this planning phase.

## Decision 1: The shared resilience modules and `discogsErrors.ts` are not relocated

**Decision**: `discogs/discogsRateLimiter.ts`, `discogs/discogsCircuitBreaker.ts`,
`discogs/discogsRetry.ts`, and `discogs/discogsErrors.ts` stay exactly where they are.
The new `adapters/discogsCatalog/discogsCatalogAdapter.ts` imports them from that
unchanged location, same as it does today via `discogsClient.ts`.

**Rationale**: Verified by reading each module's own doc comments before deciding:
`discogsRateLimiter.ts` states it is "Shared, process-local preventive throttle for
both Discogs HTTP clients"; `discogsCircuitBreaker.ts` states it is the "App-wide
circuit breaker for the shared Discogs catalog HTTP client" but is in fact imported by
`discogs/collection/collectionClient.ts` too (verified via that file's own imports,
recorded during Historia 2's research). Relocating any of the three into
`adapters/discogsCatalog/` now would force an import-path change in
`collectionClient.ts`, a file entirely outside this feature's scope and not yet
migrated (Historia 4). This is the exact same reasoning Historia 2 already applied to
`cache/cacheAside.ts` and `cache/redisClient.ts`. `discogsErrors.ts` is additionally
the cross-domain `DiscogsError` hierarchy Constitution Principle VIII's own Rationale
names as the already-conformant error-handling pattern every domain generalizes —
moving it into one domain's adapter folder would misrepresent it as owned by that one
domain.

Of these four, only `discogsRetry.ts` carries a direct infrastructure-SDK import
(`isAxiosError` from `axios`) — `discogsRateLimiter.ts` imports only the transversal
`logger`, and `discogsCircuitBreaker.ts`/`discogsErrors.ts` import nothing. That makes
`discogsRetry.ts` the one module of the four that does not qualify for Principle VIII's
"transversal module" carve-out on its own terms; its deferral rests entirely on the
"would break `collectionClient.ts`" reasoning above, not on being infrastructure-free.

**Alternatives considered**: Relocating all four into `adapters/discogsCatalog/` and
having `collectionClient.ts` import cross-domain from there — rejected; that inverts
the dependency direction Historia 4 will need (the collection domain should get its
own adapter wiring the resilience modules into, not reach into the catalog domain's
folder for shared infrastructure). Leaving the decision of a permanent shared home for
these four modules to whichever later story (3, 4, or a dedicated cleanup) actually
needs to formalize it — consistent with how Historia 2 left `CachePort`'s eventual
single home to "whichever domain needs it next," which turned out to be this one.

## Decision 2: `searchCatalog`'s cache-wrap moves to the application layer, not the adapter

**Decision**: The `DiscogsCatalogPort`'s `searchCatalog` method returns a **raw,
unenriched** search response — mapped from Discogs' API response, no rating
enrichment, no caching inside the adapter. The new
`application/discogsCatalog/searchCatalogWithRatings.ts` use case is what actually
calls `CachePort.withCache(cacheKey, ttl, async () => { ... })`, with the enrichment
fan-out (per-result community rating lookup, graceful per-result degradation) running
**inside** that cached callback — exactly where it runs today inside
`discogsClient.ts`'s `searchCatalog`. Every other port method
(`getRelease`/`getArtist`/`getMasterRelease`/`getMasterReleaseVersions`/
`getReleaseRating`) keeps its cache-wrap inside the adapter, since none of those has an
application-layer enrichment step wrapping it.

**Rationale**: Today, `searchCatalog`'s cached value **is** the fully-enriched
response — a cache hit costs exactly one Redis read, with zero rating lookups, since
the ratings are already baked into what was cached the first time. A naive split
(port method = raw + cached, enrichment applied unconditionally afterward by the
application layer) would silently turn every cache hit into N additional rating-cache
reads (one per eligible result) that don't happen today — a real, easy-to-miss
performance regression that would still technically "pass" a behavior-equivalence test
that only checks response *content*, not the number of cache operations behind it.
Keeping the cache-wrap at the layer that owns the "what gets cached" decision (the
enrichment use case, since it decides what the final cached shape is) preserves the
exact cache key, exact TTL, and exact "one read on a hit" cost this endpoint has today.

**Alternatives considered**: Caching inside the adapter's `searchCatalog` (raw only)
and caching *again* at the application layer for the enriched result (two cache
entries) — rejected: doubles Redis storage for the same logical response and drifts
from "reuse the caching contract, don't invent a second usage pattern for it."
Caching only the raw port-level `searchCatalog` and re-running enrichment on every
call, cached or not — rejected per the Rationale above; this is the regression this
decision exists to avoid.

## Decision 3: `CachePort` is relocated out of `ports/library/` to a shared `ports/cache/`, and extended with `withCache<T>`

**Decision**: `ports/library/cachePort.ts` moves to `ports/cache/cachePort.ts`, gaining
one new method: `withCache<T>(key: string, ttlSeconds: number, fetcher: () => Promise<T>): Promise<T>`,
matching `cache/cacheAside.ts`'s existing `withCache` signature and behavior
(fail-soft, single-flight coalescing of concurrent calls for the same key) verbatim.
`adapters/library/cacheAdapter.ts` moves to `adapters/cache/cacheAdapter.ts`, gaining
an implementation of `withCache` that delegates to the still-unmoved
`cache/cacheAside.ts`. The library domain's `application/library/syncLibrary.ts` and
its composition root (`adapters/library/libraryRoutes.ts`) are updated to import from
the new shared paths — an import-path fix only, no behavior change, no new duplicate
`CachePort`.

**Rationale**: Historia 2's research.md (Decision 4) explicitly reasoned that
`CachePort` stayed library-scoped *because* library was the only consumer at the
time, and named "once every domain that needs caching has its own working `CachePort`
to consolidate against" as the trigger for eventually sharing it. This feature is
exactly that trigger arriving one domain early: the parent user story's own acceptance
criterion for this story says "reutilizando el CachePort ya definido en la Historia 2
en vez de crear uno nuevo" (reusing the `CachePort` already defined in Historia 2
instead of creating a new one) — which is only literally possible if it lives
somewhere both domains can import from without one reaching into the other's folder.
`has`/`set` are unchanged, so this is additive from the library domain's perspective:
its existing behavior, tests, and fail-soft contract are unaffected by the move.

**Alternatives considered**: Defining a second, catalog-scoped port
(`ports/discogsCatalog/cachePort.ts`) with just the `withCache` method the catalog
domain needs, leaving library's `has`/`set` port untouched — rejected: this is
precisely the "duplicated as a second, parallel contract" outcome spec.md FR-002
explicitly forbids, and it does not satisfy the parent user story's explicit "reuse,
don't recreate" instruction. Deferring the relocation to Historia 6 as originally
planned and having the catalog domain define its own provisional `CachePort` in the
meantime — rejected for the same reason; Historia 6's "consolidation" step was always
about the *shape* differing across domains until they'd each been validated, not about
tolerating outright duplicate definitions of the same concept the moment a second
domain needs it.

## Decision 4: `discogsMapper.ts` and `discogs/types.ts` relocate; nothing else in `discogs/` does

**Decision**: `discogs/discogsMapper.ts` moves to `adapters/discogsCatalog/discogsMapper.ts`
unchanged. `discogs/types.ts` moves to `domain/discogsCatalog/types.ts` unchanged. Both
of the library domain's files that import from `discogs/types.ts` today
(`application/library/createLibraryEntry.ts`, `domain/library/types.ts`) get their
import path updated to the new location (spec.md FR-009); nothing else in the codebase
imports from either file (verified by search).

**Rationale**: The parent user story's own "Fuera de alcance" note for this story says
not to touch `discogsMapper.ts` "más allá de moverlo de carpeta" (beyond moving it) —
an explicit move instruction, unlike the resilience modules. Confirmed via search that
neither `discogsMapper.ts` nor `discogs/types.ts` is imported by
`collectionClient.ts`, `discogsOauthService.ts`, or any other not-yet-migrated file —
both are catalog-domain-owned with no shared-infrastructure conflict, so the "would
break another domain" reason that keeps the resilience modules in place does not apply
to them.

**Alternatives considered**: Leaving `discogs/types.ts` in place since it is "just
types" with no runtime behavior — rejected for consistency with Historia 2's own
precedent (library's `types.ts` moved into `domain/library/` even though it's equally
inert), and because the parent user story frames a `domain/discogsCatalog/` folder as
implied by "capas obligatorias: dominio, aplicación, puertos, adaptadores" applying to
every migrated domain, not just to files with runtime logic.

## Decision 5: "Masters surface first" search-result ordering stays in the driving adapter

**Decision**: The reordering that puts master-type results ahead of every other result
on a given page (`routes/discogs.ts`'s current post-processing after calling
`searchCatalog`) stays in `adapters/discogsCatalog/discogsRoutes.ts`, applied to the
use case's return value before building the JSON response. It does not move into
`application/discogsCatalog/searchCatalogWithRatings.ts`.

**Rationale**: The existing code comment on this logic already frames it as
presentation: "Masters surface ahead of every other result within this page/batch...
best-effort, per-page only." It operates purely on the shape of an already-fetched,
already-enriched page for display purposes and does not affect what is fetched,
cached, or enriched — the same category of concern as library's `serializeEntry`
(HTTP response shaping), which Historia 2 kept in the driving adapter rather than the
application layer. Keeping it in the route also means this migration changes as little
about `routes/discogs.ts`'s existing structure as possible for a concern spec.md's
edge cases explicitly said must not change behavior either way.

**Alternatives considered**: Moving it into the search use case since it's related to
search — rejected; "presentation order of an HTTP response" and "which results get a
rating attached" are different categories, and the existing code and comment already
draw that line at the route boundary.
