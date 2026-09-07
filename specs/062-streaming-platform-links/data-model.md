# Phase 1 Data Model: "Escúchalo en Streaming"

No persistent schema changes. All types below are in-memory / on-the-wire only. Cache entries live
in Redis under the `streaming:*` namespace with a 90-day TTL.

## Domain types (`backend/src/domain/streaming/types.ts`)

### `StreamingPlatform`

```
type StreamingPlatform = 'apple_music';
// Future (out of scope, no code yet): 'spotify' | 'amazon_music' | 'deezer' | 'tidal'
```

Union is the single place a platform id is declared. Adding a platform later adds a member here and
a resolver to the list — nothing else in the domain/application layer changes.

### `Storefront`

```
type Storefront = string;   // ISO-3166-1 alpha-2, uppercase, e.g. 'ES', 'US', 'GB'
```

Derived per request from locale (see `research.md` §4). Fallback `'ES'`.

### `StreamingLinkQuery`

Input to a resolver for one record + one storefront.

| Field | Type | Notes |
|---|---|---|
| `barcodes` | `string[]` | Raw `Barcode`-type identifier values from Discogs; may be empty (masters, older releases). Normalised (digits only) inside the adapter. |
| `artist` | `string` | Primary artist display name. Required (query disabled without it). |
| `title` | `string` | Release/master title. Required. |
| `storefront` | `Storefront` | Which store to resolve against. |

### `ResolvedStreamingLink`

One successful match. This is also the on-the-wire item shape.

| Field | Type | Notes |
|---|---|---|
| `platform` | `StreamingPlatform` | e.g. `'apple_music'`. |
| `url` | `string` | Absolute `https://` album page (`collectionViewUrl`). The link target. |

### `StreamingLinksResult`

Use-case output / response body.

| Field | Type | Notes |
|---|---|---|
| `links` | `ResolvedStreamingLink[]` | Zero or more, one per platform that produced a reliable match. Order = resolver-list order. Empty array is valid and common. |

### `StreamingResolutionError` (`backend/src/domain/streaming/streamingErrors.ts`)

Mirrors the `DiscogsError` pattern.

```
abstract class StreamingResolutionError extends Error {
  abstract readonly code: 'unavailable' | 'rate_limited';
}
class StreamingUnavailableError extends StreamingResolutionError { code = 'unavailable'; }
class StreamingRateLimitedError extends StreamingResolutionError { code = 'rate_limited'; }
```

Thrown by a resolver for a **transient** failure only. A "record not on this platform" is **not**
an error — it is a `null` return. The use case catches these per-platform, logs, and omits the
platform. The route never turns them into a non-200 (the section must degrade silently).

## Resolution state machine (per platform, per record, per storefront)

```
                     ┌─────────────── cache hit ──────────────┐
                     │                                        │
   request ──▶ cache lookup ──miss──▶ resolver.resolve(query) ─┼─▶ ResolvedStreamingLink ─▶ cache(90d) ─▶ include in links[]
                     │                        │                │
                     │                        ├─ null ─────────┼─▶ cache(90d) ─────────────▶ omit (no link)
                     │                        │                │
                     │                        └─ throws  ──────┘   (NOT cached) ───────────▶ omit + log transient_failure
                     │
                     └── cached null ─▶ omit      └── cached link ─▶ include
```

- **matched** → `links[]` contains it; cached 90 days; every subsequent view (same storefront) is a
  cache hit (SC-003).
- **no-match (confirmed)** → cached 90 days as `null`; subsequent views do not re-query (SC-003) but
  after 90 days the entry expires and the next view re-resolves (picks up newly-added albums).
- **transient failure** → nothing cached; the very next view re-resolves (FR-013, spec edge case
  "navigates away before resolution completes" still benefits because a *completed* attempt by any
  viewer is cached).

## Cache key

```
streaming:<platform>:<recordKey>:<storefront>

recordKey = sha1(
  normalisedBarcodes.sort().join(',') + '|' +
  normalize(artist) + '|' +
  normalize(title)
)
```

Content-derived (not Discogs-ID-derived) so the same record resolves to one entry across the
release page, the master page, a library record, and any future preview popup — satisfying FR-002
without passing IDs to the component. `normalize` is the shared domain function from `matching.ts`.

## On-the-wire (see `contracts/streaming-links-api.md`)

`GET /api/streaming/links?artist=…&title=…&barcode=…&barcode=…&locale=es-ES`
→ `200 { "links": [ { "platform": "apple_music", "url": "https://music.apple.com/es/album/…" } ] }`
→ `200 { "links": [] }` when nothing matched or every resolver failed transiently.

## Frontend types (`frontend/src/services/streamingApi.ts`)

```
interface StreamingLink { platform: 'apple_music'; url: string; }   // widen union as platforms land
interface StreamingLinksResponse { links: StreamingLink[]; }
interface StreamingLinksInput { barcodes: string[]; artist: string; title: string; locale: string; }
```

`StreamingLinksSection` derives `barcodes` from `Release.identifiers` where `type === 'Barcode'`;
for a master (no `identifiers`) `barcodes` is `[]`.

## Platform display metadata (frontend, static)

A small const map — **not** domain data, purely presentational:

| platform | label | icon | accessible name |
|---|---|---|---|
| `apple_music` | "Apple Music" | `AppleMusicIcon` (inline SVG, `currentColor`) | "Escuchar en Apple Music" |

Adding a platform later adds one row here + one adapter server-side.
