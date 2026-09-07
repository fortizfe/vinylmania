# Phase 1 Data Model: Mi colección en cifras

Domain types live in `backend/src/domain/collectionStats/types.ts` unless noted. Nothing here is a new persisted collection — the only storage change is three additive fields on the existing `LibraryEntry` Firestore document.

## 1. Persistence change — `LibraryEntry` (existing Firestore document)

`backend/src/domain/library/types.ts` — three new optional fields, populated by `syncLibrary` from the collection `basic_information`, exactly like feature 038's `genre`/`style`/`format` write-back.

| Field | Type | Notes |
|-------|------|-------|
| `year` | `number \| undefined` | Release year from `basic_information.year`. `0` / missing → `undefined` → counted as "Año desconocido". |
| `label` | `string[] \| undefined` | Distinct label names from `basic_information.labels[].name`. |
| `primaryArtist` | `string \| undefined` | `basic_information.artists[0].name`, with the trailing Discogs disambiguation suffix (`" (2)"`) trimmed. `"Various"` / `"Various Artists"` preserved verbatim so the aggregator can exclude it. |

- **Additive & backfilled**: absent until the entry's next sync; a failed sync leaves prior values untouched (same rule as feature 038 / FR-024 there). No migration.
- `addedAt` (existing) is **reconciled** on every sync: set to `new Date(instance.dateAdded).toISOString()` when it differs, so discogs.com-added and first-sync-pushed entries are both dated by the real Discogs `date_added` (FR-010).

## 2. `CollectionInstance` enrichment (existing type, `domain/discogsOauth/collectionTypes.ts`)

The adapter already returns `CollectionInstance` from `mapInstance`. Add the `basic_information` facets it currently discards, so the valuation use case and the sync write-back can both read them from one collection walk:

| New field | Type | Source (`basic_information`) |
|-----------|------|------------------------------|
| `year` | `number \| null` | `.year` (`0` → `null`) |
| `labelNames` | `string[]` | `.labels[].name` (deduped) |
| `artistNames` | `string[]` | `.artists[].name` (suffix-trimmed) |
| `genres` | `string[]` | `.genres` (may be `[]` if absent) |
| `styles` | `string[]` | `.styles` (may be `[]` if absent) |

Existing fields (`releaseId`, `instanceId`, `folderId`, `rating`, `mediaCondition`, `sleeveCondition`, `notes`, `dateAdded`) are unchanged.

## 3. `CollectionStatistics` (Block 1 payload)

```
CollectionStatistics
├─ totalRecords: number
├─ byDecade: StatBreakdown          // full list, chronological or by count (Phase 2 copy call)
├─ byGenre: StatBreakdown           // top ~12 + `others`
├─ byStyle: StatBreakdown           // top ~12 + `others`
├─ byLabel: StatBreakdown           // top ~12 + `others`
├─ topArtists: ArtistCount[]        // desc by count, length ≤ 10; excludes "Various Artists"
├─ mostPresentArtist: ArtistCount | null
└─ growth: GrowthSeries
```

```
StatBreakdown
├─ buckets: StatBucket[]            // { label: string; count: number }, desc by count
└─ others: { count: number; hiddenBuckets: number } | null   // null when nothing was truncated

ArtistCount { name: string; count: number }

GrowthSeries
├─ granularity: 'month'             // 'month' series; 'year' rollup derived client-side or included
├─ points: GrowthPoint[]            // ascending by period
   └─ GrowthPoint { period: string /* 'YYYY-MM' */; added: number; cumulative: number }
```

**Rules** (all covered by `aggregateStatistics` unit tests):
- Decade bucket label from `Math.floor(year/10)*10` → e.g. `"1970s"`; `year === undefined` → `"Año desconocido"` bucket, still in `totalRecords`.
- Genre/style/label: one `+1` per distinct value on the entry; a bucket sum may exceed `totalRecords`.
- Artist: `+1` for `primaryArtist` only (one per entry); skip when it is `undefined` or matches `/^various(\s+artists)?$/i`.
- Growth: group entries by `addedAt` month; `added` = count that month; `cumulative` = running sum over all months from the earliest; months with zero additions still appear between populated months so the cumulative line is continuous.
- `others`: after desc sort, keep the first `TOP_N` (~12), collapse the rest into `others` (`count` = sum, `hiddenBuckets` = number collapsed). Decade is never collapsed.

## 4. `CollectionValuation` (Block 2 payload — running, returned by each chunk)

```
CollectionValuation
├─ currency: string | null          // e.g. 'EUR'; null until the first priced disc
├─ estimatedTotal: number           // sum of covered per-disc values, 2-dp
├─ coveredCount: number             // discs with a usable price this far
├─ totalCount: number               // instances in the collection (denominator of "X de Y")
├─ uncovered: { noMarketData: number; noCondition: number }   // reasons, for transparency
├─ topValuable: PerDiscValue[]      // desc by value, length ≤ 10
└─ status: 'partial' | 'complete' | 'unavailable'
```

```
PerDiscValue
├─ releaseId: number
├─ instanceId: number
├─ title: string                    // from basic_information
├─ artist: string
├─ mediaCondition: MediaCondition | null
├─ value: number | null             // null → not covered
└─ reason: 'ok' | 'no_market_data' | 'no_condition'
```

**Rules** (covered by `computeValuation` unit tests):
- Per disc: `value = suggestionsByRelease[releaseId]?.[mediaCondition]?.value ?? null`.
- `mediaCondition === null` → `reason: 'no_condition'`, excluded, `uncovered.noCondition += 1` (FR-018).
- release priced but the exact grade absent, or release returned no data → `reason: 'no_market_data'`, `uncovered.noMarketData += 1` (FR-016, edge case).
- `estimatedTotal` = Σ covered `value`; `coveredCount` = count of `reason === 'ok'`.
- `currency` taken from the first suggestion encountered; if a later suggestion reports a different currency (not expected — it's the user's one seller currency), keep the first and log a warning.
- `status`: `'complete'` when every instance has been attempted; `'partial'` while the cursor loop continues; `'unavailable'` when the marketplace endpoint reported missing seller settings or a full outage before any disc was priced.
- Multiple instances of one release are each a `PerDiscValue` and each add to the total (edge case).

## 5. Full per-disc breakdown (behind a disclosure)

The `GET /valuation` response's final (`status: 'complete'`) page includes the complete `perDisc: PerDiscValue[]` list (all instances, covered and not), which the frontend shows in `ValuationBreakdownDialog`. Intermediate pages omit `perDisc` (only `topValuable`) to keep payloads small.

## 6. Errors (`domain/collectionStats/statsErrors.ts`)

| Error | Thrown when | Route → HTTP |
|-------|-------------|--------------|
| `DiscogsNotLinkedError` (re-exported) | no connection for the uid | `409 { code: 'discogs_not_linked' }` |
| `DiscogsAuthError` (existing) | stored OAuth credentials rejected (401/403, not seller-settings) | `401 { code: 'discogs_link_invalid' }` |
| `SellerSettingsRequiredError` (new) | `price_suggestions` 403 with the seller-settings signal | `422 { code: 'seller_settings_required' }` — Block 2 only; Block 1 still 200 |
| `DiscogsUnavailableError` / `DiscogsRateLimitError` (existing) | breaker open / exhausted retries / 429 | valuation responds `200` with `status: 'unavailable'` (or `partial` if some discs already priced) — never a 5xx that would blank the screen (FR-025, SC-009) |

`GET /statistics` never depends on the marketplace endpoint, so it only ever fails with the two link-gate errors (or a `200` with a partial/empty collection).

## 7. Cache keys

| Key | TTL | Written by | Notes |
|-----|-----|-----------|-------|
| `discogs:pricesuggest:{uid}:{releaseId}` | 7 d | `discogsMarketplaceAdapter.getPriceSuggestions` via `cacheAdapter.withCache` | value is the full per-condition map **or** a `null` sentinel (negative cache) |
| `discogs:statsinstances:{uid}` | ~5 min | `getCollectionValuation` | brief cache of the `CollectionInstance[]` list so the chunk loop doesn't re-walk the collection each call; shares the spirit of the library sync marker |
| `discogs:libsync:{uid}` (existing) | 5 min | `syncLibrary` | unchanged; `getCollectionStatistics` calls `syncLibrary` which honors this marker |

## 8. Frontend types (`frontend/src/services/collectionStatsApi.ts`)

Mirror the backend payloads: `CollectionStatistics`, `StatBreakdown`, `GrowthSeries`, `CollectionValuation`, `PerDiscValue`, plus `ValuationChunkResponse { valuation, status, nextCursor, perDisc? }`. No behavior — DTOs only.
