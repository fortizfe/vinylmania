# Contract: `GET /api/discogs/search`

This feature changes the **shape of the `genre` and `style` request params** on an existing endpoint. No new endpoint is introduced. Response shape is unchanged.

## Request

```
GET /api/discogs/search?q={query}&type={release|artist}&page={n}&perPage={n}&genre={g1,g2}&style={s1,s2}&format={f1,f2}
Authorization: <required, see requireAuth middleware>
```

- **Changed**: `genre` and `style` are now comma-joined multi-value strings, exactly like `format` already is (`backend/src/routes/discogs.ts` `FILTER_PARAM_NAMES`/`parseFilterParams` — no route code change needed, since these three params already share one generic parsing path). A single value (e.g. `genre=Rock`) remains valid and behaves as it does today (one-element case of the same shape).
- All other params unchanged.

## Response (unchanged)

```json
{
  "results": [ { "discogsId": 1, "resultType": "master", "...": "..." }, "..." ],
  "pagination": { "page": 1, "pages": 5, "items": 100, "perPage": 20 }
}
```

No field added/removed. Multi-value `genre`/`style` are expected to OR-match the same way `format` already does against Discogs' `/database/search` (research.md Decision 1) — verified by a contract/integration test before this ships, not assumed from Discogs' documentation alone.

## Consumers

- `frontend/src/services/discogsApi.ts` (`search()`) — `format` is already split out and comma-joined (`:37-44`); `genre`/`style` move from the generic single-string `textFilters` loop to the same array-join treatment as `format`.
- `frontend/src/hooks/useSearchQueryParams.ts` — `SearchFilters.genre`/`SearchFilters.style` change from `string` to `string[]`; `TEXT_FILTER_PARAM_NAMES`'s generic parse/build loop already supports this shape change without new branching (only the type changes, not the parsing logic), matching how `format` is already handled by its own `parseFormatParam`/`buildFormatParam`.
- `frontend/src/pages/SearchResultsPage.tsx`, `frontend/src/components/HeaderSearchBox.tsx`, `frontend/src/queries/discogsQueries.ts` — each currently destructures `genre`/`style` as scalars and must be updated to the array shape.

## Backward compatibility

Additive/behavioral (Principle VI: MINOR). A stale bookmarked URL with a single-value `genre=Rock` continues to work unchanged (one-element array case). No stored data or schema is affected — this is a request-shape change only.
