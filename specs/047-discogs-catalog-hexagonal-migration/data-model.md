# Phase 1 Data Model: Discogs Catalog Domain Migrated to Hexagonal Architecture

This migration does not add, remove, or change the shape of any catalog entity — it
relocates existing types (`backend/src/discogs/types.ts`) into
`domain/discogsCatalog/types.ts` unchanged (research.md Decision 4) and introduces one
new domain port (`DiscogsCatalogPort`) plus an extension to the existing `CachePort`
(research.md Decision 3).

## Domain Entities (relocated unchanged from `discogs/types.ts`)

All of these are read-only, Discogs-sourced catalog data — this backend never writes
them back to Discogs and never persists them locally; they exist only as the shape
returned to callers (directly, or as part of an enriched search result).

| Entity | Key fields | Notes |
|---|---|---|
| `Release` | `discogsId`, `title`, `artists`, `labels`, `formats`, `genres`, `styles`, `tracklist`, `images`, `community?`, `masterId?` | The full release detail |
| `Artist` | `discogsId`, `name`, `profile?`, `aliases`, `images` | |
| `MasterRelease` | `discogsId`, `title`, `artists`, `mainReleaseId`, ... | A master release group (feature 026); `mainReleaseId` is what a master's community rating is sourced from — masters have no rating endpoint of their own |
| `MasterReleaseVersion` / `MasterReleaseVersionsPage` | `discogsId`, `title`, `format?`, pagination | One page of a master's version list |
| `CatalogSearchResult` / `CatalogSearchResponse` | `discogsId`, `resultType` (`release`\|`artist`\|`master`), `communityRating?`, pagination | `communityRating` is an *additive enrichment* — absent until the search-with-ratings use case attaches it |
| `CommunityRating` | `average`, `count` | Attached to a search result, or returned standalone from a direct rating lookup |

## Port Contracts (new / extended)

| Port | Application-layer consumers | Adapter (this feature) | Wraps (unmoved) |
|---|---|---|---|
| `DiscogsCatalogPort` | `searchCatalogWithRatings` (this feature); `createLibraryEntry`, `enrichLibraryEntry` (library domain, import-path fix only, still calling `getRelease` directly — see Edge Cases below) | `adapters/discogsCatalog/discogsCatalogAdapter.ts` | `axios` (direct), `discogsRateLimiter.ts`/`discogsCircuitBreaker.ts`/`discogsRetry.ts` (unmoved, shared) |
| `CachePort` (extended) | `searchCatalogWithRatings` (new `withCache` consumer); `discogsCatalogAdapter`'s other five methods (new `withCache` consumers); `syncLibrary` (existing `has`/`set` consumer, import-path fix only) | `adapters/cache/cacheAdapter.ts` (relocated from `adapters/library/`) | `cache/redisClient.ts` (`has`/`set`, unmoved), `cache/cacheAside.ts` (`withCache`, unmoved) |

## Caching Map (unchanged keys/TTLs, now read through `CachePort.withCache`)

Recorded here because it's existing, load-bearing behavior this migration must not
disturb — every key and TTL is copied verbatim from today's `discogsClient.ts`:

| Lookup | Cache key | TTL |
|---|---|---|
| `getRelease` | `discogs:release:{id}` | 6 hours |
| `getArtist` | `discogs:artist:{id}` | 6 hours |
| `getMasterRelease` | `discogs:master:{id}` | 6 hours |
| `getMasterReleaseVersions` | `discogs:master-versions:{id}:{page}:{perPage}` | 6 hours |
| `getReleaseRating` | `discogs:rating:{releaseId}` | 30 minutes |
| `searchCatalogWithRatings` (application layer, includes enrichment — research.md Decision 2) | `discogs:search:{resultType}:{query}:{page}:{perPage}:{genre}:{style}:{format}` | 30 minutes |

## Rating Enrichment Rule (`searchCatalogWithRatings`, relocated unchanged)

Not a new rule — recorded here to make explicit that its behavior is preserved exactly
across the migration (spec.md User Story 2):

1. Run the raw catalog search (`DiscogsCatalogPort.searchCatalog`) for the requested
   page.
2. For each result of type `release` or `master`, resolve the release ID to rate (a
   master's rating is sourced from its `mainReleaseId`, via `getMasterRelease` first).
3. Look up that release's community rating (`getReleaseRating`), bounded to a fixed
   number of concurrent lookups across the whole page.
4. On success with a non-zero rating count, attach `communityRating` to the result. On
   any failure (not found, rate-limited, unavailable) or a lookup exceeding its own
   short timeout, leave the result exactly as it was — the search as a whole never
   fails because of a rating lookup (Constitution Principle VII).
5. The whole enriched page (not just the raw search) is what gets cached, so a
   subsequent identical request within the TTL costs one cache read and zero rating
   lookups (research.md Decision 2).

## Edge Case: existing cross-domain consumers of the release lookup

`application/library/createLibraryEntry.ts` and
`application/library/enrichLibraryEntry.ts` (library domain, migrated in the prior
story) both call `getRelease` directly today, imported from `discogs/discogsClient.ts`
— documented at the time as an explicit, deliberate carry-over for this story to
resolve. After this migration, both files' import updates to point at wherever
`getRelease` now lives (the new `DiscogsCatalogPort`'s adapter, or an equivalent
call site — a planning/tasks-level detail, not a data-model concern) — an
import-path fix per spec.md FR-009, not a redesign of how the library domain consumes
the catalog. `tests/contract/collectionClient.contract.test.ts` (not this domain's
test, but it imports `getRelease` for its own seeding) gets the same fix.
