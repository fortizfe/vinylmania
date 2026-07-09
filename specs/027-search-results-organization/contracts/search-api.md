# Contract: `GET /api/discogs/search`

This feature changes the **response ordering contract** of an existing endpoint. No new endpoint is introduced. The request contract is unchanged.

## Request (unchanged)

```
GET /api/discogs/search?q={query}&type={release|artist}&page={n}&perPage={n}&genre={g}&style={s}&format={f1,f2}
Authorization: <required, see requireAuth middleware>
```

- `perPage` continues to default to 50 server-side (`DEFAULT_PER_PAGE`, `backend/src/routes/discogs.ts`) but the frontend search-results page continues to explicitly request `perPage=20` per Clarifications (unchanged from today).
- All other query params are unchanged (see existing `parsePageParams`/`parseFilterParams`).

## Response (shape unchanged, ordering behavior changed)

```json
{
  "results": [ { "discogsId": 1, "resultType": "master", "...": "..." }, "..." ],
  "pagination": { "page": 1, "pages": 5, "items": 100, "perPage": 20 }
}
```

- **Shape**: identical to today — `results: CatalogSearchResult[]` + `pagination`. No field added/removed.
- **NEW ordering guarantee** (per-page/per-batch, best-effort): within a single response's `results` array, every element with `resultType === 'master'` MUST appear before every element with `resultType !== 'master'`. Relative order within the masters group and within the non-masters group matches Discogs' original per-page order (stable partition).
- **Explicitly NOT guaranteed**: ordering across separate requests/pages. A release returned on page 1 is never moved to page 2 (or vice versa) to achieve a "more global" master-first ordering — each page is reordered independently, with no additional Discogs requests made to enforce a stronger guarantee (Clarifications Q1 → Option A).

## Consumers

- `frontend/src/services/discogsApi.ts` (`search()`) — no signature change.
- `frontend/src/queries/discogsQueries.ts` — `useCatalogSearch` is replaced by an infinite-query variant that requests successive `page` values and relies on the above per-page ordering guarantee; it does not re-sort pages after receiving them.

## Backward compatibility

Additive/behavioral only (Principle VI: MINOR). Any other consumer of this endpoint that assumed arbitrary/Discogs-native ordering is unaffected in terms of response shape; only element order within a page changes.
