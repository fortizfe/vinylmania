# Contract: `/api/collection-stats` HTTP API

All routes require `requireAuth` (Firebase session) and the `standard` rate-limit tier
(same as `/api/library`). All routes require a linked Discogs account. `{username}` is
resolved server-side from the caller's stored `DiscogsConnection` — never from the client.

Base path mounted in `backend/src/app.ts`: `app.use('/api/collection-stats', collectionStatsRouter)`.

---

## Shared error contract (reuses `respondCollectionError`, feature 060)

| Condition | Status | Body `error` |
|-----------|--------|--------------|
| No Discogs account linked | `409` | `discogs_not_linked` |
| Stored Discogs credentials rejected (revoked) | `401` | `discogs_link_invalid` |
| Invalid query params | `400` | `invalid_request` |
| Unexpected | `500` | `internal_error` |

`GET /valuation` additionally **does not** surface `discogs_rate_limited` / `discogs_unavailable`
as error statuses — it returns `200` with `status: "partial"` or `"unavailable"` so the
statistics already on screen are never replaced by an error (FR-025, SC-009).

---

## `GET /api/collection-stats/statistics`

Block 1. Computed from the synchronized library mirror — **no Discogs catalog or
marketplace request** (FR-004). Triggers the same sync-on-read as the library
(`syncLibrary`, honoring the existing `discogs:libsync:{uid}` ~5-min marker).

**Query params**

| Param | Type | Default | Notes |
|-------|------|---------|-------|
| `refresh` | `"true"` | — | Forces a fresh library sync before aggregating. |

**200 response** — `CollectionStatistics` (see [data-model.md](../data-model.md) §3)

```jsonc
{
  "totalRecords": 312,
  "byDecade": {
    "buckets": [
      { "label": "1980s", "count": 96 },
      { "label": "1970s", "count": 74 },
      { "label": "1990s", "count": 61 },
      { "label": "Año desconocido", "count": 7 }
    ],
    "others": null
  },
  "byGenre":  { "buckets": [ { "label": "Rock", "count": 210 }, { "label": "Electronic", "count": 44 } ], "others": { "count": 18, "hiddenBuckets": 6 } },
  "byStyle":  { "buckets": [ { "label": "Heavy Metal", "count": 71 } ], "others": { "count": 33, "hiddenBuckets": 12 } },
  "byLabel":  { "buckets": [ { "label": "Roadrunner Records", "count": 12 } ], "others": { "count": 140, "hiddenBuckets": 88 } },
  "topArtists": [ { "name": "Iron Maiden", "count": 14 }, { "name": "Metallica", "count": 11 } ],
  "mostPresentArtist": { "name": "Iron Maiden", "count": 14 },
  "growth": {
    "granularity": "month",
    "points": [
      { "period": "2023-01", "added": 4, "cumulative": 4 },
      { "period": "2023-02", "added": 0, "cumulative": 4 },
      { "period": "2023-03", "added": 9, "cumulative": 13 }
    ]
  }
}
```

- Empty collection → `200` with `totalRecords: 0`, empty `buckets`, `mostPresentArtist: null`, `growth.points: []` (FR-013).
- Entries not yet carrying `year` / `label` / `primaryArtist` (never synced since this feature shipped) contribute to `totalRecords` and to whatever facets they do have; a `refresh=true` (or any library browse) backfills them.

---

## `GET /api/collection-stats/valuation`

Block 2. One chunk of the progressive valuation. The frontend calls this on mount and
then repeatedly with the returned `nextCursor` until `status !== "partial"`.

**Query params**

| Param | Type | Default | Notes |
|-------|------|---------|-------|
| `cursor` | int ≥ 0 | `0` | Index into the stable cached ordering of the caller's collection instances. |
| `refresh` | `"true"` | — | On `cursor=0` only: invalidates `discogs:statsinstances:{uid}` (re-walk the collection) and all `discogs:pricesuggest:{uid}:*` for this collection (force fresh prices). |

**Behavior**

1. `cursor=0`: resolve `CollectionInstance[]` (sync-on-read, briefly cached at `discogs:statsinstances:{uid}`).
2. Price releases `[cursor, cursor+BATCH_SIZE)` (`BATCH_SIZE ≈ 25`) via `getPriceSuggestions`, served from the 7-day cache when warm, `mapWithConcurrency` limit ≈ 4 (shared throttle paces the rest).
3. Recompute `CollectionValuation` over **every** cached suggestion for the collection so far.
4. Respond.

**200 response** — `ValuationChunkResponse`

```jsonc
{
  "valuation": {
    "currency": "EUR",
    "estimatedTotal": 1843.50,
    "coveredCount": 208,
    "totalCount": 312,
    "uncovered": { "noMarketData": 71, "noCondition": 33 },
    "topValuable": [
      { "releaseId": 55, "instanceId": 9001, "title": "…", "artist": "…", "mediaCondition": "Near Mint (NM or M-)", "value": 240.00, "reason": "ok" }
    ],
    "status": "partial"
  },
  "status": "partial",           // "partial" | "complete" | "unavailable"
  "nextCursor": 25,              // present only when status === "partial"
  "pricedThisBatch": 25,
  "fromCacheThisBatch": 25       // 0 on a cold run; == pricedThisBatch within the 7-day window (SC-005)
}
```

- Final page (`status: "complete"`) additionally includes `"perDisc": PerDiscValue[]` — the full list for `ValuationBreakdownDialog` (data-model §5).
- Caller has a linked account **without Discogs seller settings** → `422 { "error": "seller_settings_required", "message": "Discogs only provides price estimates once you've completed your seller settings on discogs.com." }`. The frontend shows `ValuationUnavailableNotice`; Block 1 is unaffected.
- Discogs unavailable / rate-limited before any disc is priced → `200` with `valuation.status: "unavailable"`, no `nextCursor`. If some discs were already priced (this or a prior chunk), `status: "partial"` is returned with the covered subset and the loop retries the same `cursor` after a short client backoff.

---

## Frontend consumption

- `frontend/src/services/collectionStatsApi.ts`: `getStatistics(refresh?)`, `getValuationChunk(cursor, refresh?)`.
- `frontend/src/queries/collectionStatsQueries.ts`:
  - `useCollectionStatistics()` — `useQuery`, `retry: false`, gate on `discogs_not_linked` / `discogs_link_invalid`.
  - `useProgressiveValuation()` — drives the chunk loop (fetch on mount, follow `nextCursor` while `partial`, expose the running `valuation` + a `progress` fraction + a `notice` for `seller_settings_required` / `unavailable`).
