# Phase 0 Research: "Escúchalo en Streaming"

## 1. iTunes Search API — request/response shape

**Decision**: Use two endpoints, no auth, plain HTTPS GET, JSON response.

- **UPC / barcode lookup** (preferred): `https://itunes.apple.com/lookup?upc=<digits>&country=<CC>&entity=album`
  - Returns `{ resultCount, results: [...] }`. An album result has `wrapperType: "collection"`,
    `collectionType: "Album"`, `artistName`, `collectionName`, `collectionViewUrl` (the
    `https://music.apple.com/<cc>/album/...` page — this is the link target), `trackCount`.
  - `resultCount: 0` → the barcode is unknown to that storefront.
- **Text search** (fallback): `https://itunes.apple.com/search?term=<url-encoded artist title>&country=<CC>&media=music&entity=album&limit=10`
  - Same result shape; ranked by Apple's relevance. May include compilations and near-matches, so
    results MUST be filtered by our own match rule (see §3).

**Rationale**: The paid Apple Music API needs a developer token (out of scope per spec FR-007). The
iTunes Search API is free, keyless, CORS-open, and returns a stable `collectionViewUrl` that opens
the album in Apple Music / the browser.

**Failure modes & handling**:

| Condition | Detection | Handling |
|---|---|---|
| Barcode/text not found | `resultCount === 0` or no `collectionType === "Album"` result | Resolver returns `null` → **confirmed no-match**, cached 90 days |
| Rate limited | HTTP `403` (Apple's documented signal for >~20 req/min) | throw `StreamingResolutionError('rate_limited')` → **not cached**, retried on next view |
| Timeout / network error | `axios` timeout (`PER_CALL_TIMEOUT_MS`) or connection error | throw `StreamingResolutionError('unavailable')` → not cached |
| 5xx from Apple | status ≥ 500 | throw `StreamingResolutionError('unavailable')` → not cached |
| Malformed body | JSON parse fails / shape unexpected | throw `StreamingResolutionError('unavailable')` → not cached (never a bad link) |
| `Content-Type: text/javascript` | Apple sometimes returns this for JSON | parse as JSON regardless of content-type |

**Alternatives considered**: MusicBrainz + streaming-link aggregators (Odesli/song.link) — rejected:
Odesli is itself rate-limited and adds a dependency and a second point of failure; MusicBrainz
requires its own matching. The spec explicitly names the iTunes Search API.

**Per-call resilience**: `PER_CALL_TIMEOUT_MS = 4000`, at most one retry on a network error / 5xx
with a short backoff (~500 ms). No circuit breaker (the Discogs one is a Discogs-specific singleton;
YAGNI here — the 90-day cache already makes calls rare).

## 2. Rate limit (~20 req/min) strategy

**Decision**: Rely primarily on the **90-day cache**; add a small **in-process
minimum-interval throttle** in `itunesSearchAdapter` (serialize iTunes calls with a ~3 s minimum
spacing ⇒ ≤ 20/min) so a burst of cache-misses degrades to "some resolve now, the rest throw
`rate_limited`/`unavailable` and resolve on a later view" rather than hammering Apple.

**Rationale**: On a personal-scale app, the only way to approach 20/min is many *distinct* uncached
records in one minute (e.g. fast browsing of a large fresh search). A short throttle bounds that
without any queue infrastructure. Because a throttled/failed call is *not* cached (§1), no record is
permanently harmed — it just resolves on the next visit.

**Alternatives considered**: a Redis-backed token bucket (like `discogsRateLimiter`) — rejected as
over-engineering for this volume (KISS); a background pre-warming job — rejected (spec says
resolution is on-demand; no scheduled jobs, mirroring the Discogs sync decision in feature 060).

## 3. Match-acceptance rules

**Decision** (pure functions in `domain/streaming/matching.ts`):

- **Normalisation** `normalize(s)`: lowercase → strip diacritics (NFD + remove combining marks) →
  remove punctuation → collapse whitespace → drop trailing parenthetical/bracketed qualifiers
  (`(remastered)`, `(deluxe edition)`, `[2011 remaster]`, `- 2009 remaster`).
- **UPC lookup result**: accept the first `collectionType === "Album"` result **without** further
  text checks — a UPC is an exact identifier. (Guard only: if `artistName` normalises to something
  wholly unrelated *and* the release artist is known, treat as no-match; this catches the rare
  reused/rebadged barcode from the spec edge cases.)
- **Text search result**: accept a candidate only if **both**
  - `normalize(candidate.artistName)` matches `normalize(queryArtist)` — equal, or one contains the
    other (handles "Metallica" vs "Metallica feat. …"), or `queryArtist` normalises to `various` and
    candidate is a compilation; **and**
  - `normalize(candidate.collectionName)` matches `normalize(queryTitle)` — equal, or one contains
    the other with ≥ 0.6 token-overlap (Jaccard on word sets).
  - Pick the highest-ranked (first) candidate that passes. If none pass → `null` (no-match).
- Never guess: an ambiguous or partial match is a no-match (spec edge case).

**Rationale**: Barcode is authoritative; the text fallback is the risky path, so it is deliberately
strict (both fields must correspond) to honour SC-006 (≥ 95% correct on text-fallback links) and
FR-009 (never a wrong/broken link). This matches the Assumption already recorded in the spec.

**Alternatives considered**: fuzzy string distance (Levenshtein) thresholds — rejected as harder to
reason about and test than normalised containment + token overlap; accepting the top search result
unconditionally — rejected (would produce wrong links for obscure records, violating FR-009).

## 4. Locale → storefront mapping

**Decision** (`adapters/streaming/storefront.ts`, `localeToStorefront(explicitLocale?, acceptLanguage?)`):

1. Prefer an explicit `?locale=` query param (frontend sends `navigator.language`), else the
   request's `Accept-Language` header, else fallback.
2. Parse the first language tag; if it has a region subtag (`es-ES`, `pt-BR`) → uppercase region.
3. If language-only (`es`, `en`) → map via a small table: `es→ES, en→US, pt→PT, fr→FR, de→DE,
   it→IT, nl→NL, ja→JP` (extend as needed).
4. Validate against a known iTunes storefront set (ISO-3166 alpha-2 that iTunes supports). Unknown
   or unparseable → **`ES`** (spec Clarifications fallback).

**Rationale**: No new user data (spec Clarifications — locale-derived, no profile field). ISO-3166
region subtags are already what iTunes' `country` param wants. `ES` fallback matches the app's
primary audience.

**Alternatives considered**: IP geolocation — rejected (adds a dependency + privacy surface, spec
Clarifications chose locale); a user-set country field — rejected (spec Clarifications: no new
field).

## 5. Caching

**Decision**: `cache.withCache(key, 90d, fetcher)` from the existing `CachePort`.

- **Key**: `streaming:<platform>:<recordKey>:<storefront>` where
  `recordKey = sha1(sortedNormalisedBarcodes.join(',') + '|' + normalize(artist) + '|' + normalize(title))`
  — content-derived, so the same record resolves to the same entry from any surface (release page,
  master page, library record, a future popup) without threading Discogs IDs through the component.
- **What is cached**: a `ResolvedStreamingLink` (match) or `null` (confirmed no-match) — both are
  JSON-round-trippable through `withCache`.
- **What is NOT cached**: a thrown `StreamingResolutionError` — `withCache` only caches a resolved
  value, so a transient failure naturally propagates and leaves no entry (FR-013). ✅ matches the
  fail-soft `cacheAside` implementation.
- **TTL**: `90 * 24 * 60 * 60 = 7_776_000` s. Redis handles large TTLs fine.
- **Fail-soft**: if Redis is down/unconfigured, `withCache` calls the fetcher directly every time —
  correct, just more iTunes calls; the throttle (§2) still bounds them.

**Rationale**: Reuses the exact mechanism `feeds` and `searchCatalogWithRatings` already use; no new
cache abstraction (KISS). Content-derived key avoids a `recordKey` prop and makes the section
trivially reusable.

**Note (accepted)**: A volatile Redis restart drops cache entries early → re-resolution. Acceptable
per the fail-soft contract; not worth persistence config for this feature.

## 6. Per-platform isolation (FR-005)

**Decision**: `resolveStreamingLinks` iterates the injected `StreamingResolverPort[]` and awaits
them with `Promise.allSettled` (or a simple per-item `try/catch`), each wrapped in its own
`cache.withCache`. A rejected/thrown resolver is logged and contributes nothing to the result
array; a `null` contributes nothing but *is* cached; a `ResolvedStreamingLink` is pushed. The result
is `{ links: ResolvedStreamingLink[] }` — order follows the resolver-list order.

**Rationale**: `allSettled` gives structural isolation for free — one platform's failure can't
reject the batch. With one platform today this is trivial, but it is the exact shape a second
platform plugs into with zero changes (FR-006).

## 7. Where the section sits in the detail layout

**Decision**: Render `StreamingLinksSection` as the **last** card/section on each detail page
(after tracklist and "other details"). 

**Rationale**: FR-014 requires a skeleton that may then collapse to nothing. Placing the section
last means a skeleton→collapsed transition reflows only empty space below it — satisfying FR-017's
"must not push the surrounding record detail around" for the overwhelming majority of views, while
still showing the skeleton the Clarifications session asked for. On a match, the section stays and
shows the link(s).

**Alternatives considered**: directly under the main info / actions — rejected: a collapse there
would shift the tracklist and everything below on every not-on-Apple-Music record (common in this
catalogue), which is the exact jank FR-017 forbids.

## 8. Frontend data flow

**Decision**: `StreamingLinksSection` takes `{ identifiers?, artist?, title? }` (already present on
`Release`; `MasterRelease` has `artists`+`title` but **no `identifiers`** → barcodes empty → text
fallback, matching the spec's master-resolution assumption). It derives
`barcodes = identifiers.filter(i => i.type === 'Barcode').map(i => i.value)`, calls
`useStreamingLinks({ barcodes, artist, title, locale: navigator.language })`
(`enabled` only when `artist && title`), TanStack Query with a long `staleTime` (e.g. `Infinity`
within a session — the 90-day authority is the server cache) and `retry: 1`.

**Rationale**: Mirrors `useCatalogRelease` conventions. The component owns the "derive barcodes"
detail so all three mount points just pass the record object's fields.
