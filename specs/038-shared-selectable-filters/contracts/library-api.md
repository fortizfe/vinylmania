# Contract: `GET /api/library`

This feature adds **optional filter query params** to an existing endpoint and changes its pagination behavior when they are present. No new endpoint is introduced.

## Request

```
GET /api/library?page={n}&pageSize={n}&refresh={true|false}&genre={g1,g2}&style={s1,s2}&format={f1,f2}
Authorization: <required, see requireAuth middleware>
```

- **New**: `genre`, `style`, `format` — optional, comma-joined multi-value strings, parsed the same way as the Search endpoint's equivalent params (same `FILTER_PARAM_NAMES`/`parseFilterParams` shape, reused rather than reinvented). Omitted/blank means "no filter on this field."
- `page`, `pageSize`, `refresh` — unchanged.

## Response (shape unchanged, values change when filters are active)

```json
{
  "items": [ { "id": "...", "catalogStatus": "ok", "release": { "...": "..." }, "genre": ["Rock"], "style": ["Grunge"], "format": ["Vinyl"], "...": "..." } ],
  "page": 1,
  "pageSize": 20,
  "totalItems": 7
}
```

- **New fields on each item**: `genre`, `style`, `format` — the entry's persisted catalog values (data-model.md), present alongside the existing `catalogStatus`/`release`/other fields. Absent (`undefined`) on an entry that has never been successfully enriched.
- **Unfiltered request** (no genre/style/format params): behavior and pagination source unchanged — still the existing Firestore-side `listEntries` page (`orderBy('addedAt','desc').offset().limit()`).
- **Filtered request** (at least one of genre/style/format present): `items`/`page`/`pageSize`/`totalItems` are computed over the in-application-filtered subset (research.md Decision 2) — `totalItems` is the count of entries matching all active filters (AND across genre/style/format, OR within each field's selected values), not the full library size, and `page`/`pageSize` slice that filtered subset. An out-of-range `page` for the filtered subset returns an empty `items` array (same convention as today for the unfiltered case).
- **No matches**: `items: []`, `totalItems: 0` — the frontend renders the "no results for the active filters" message (FR-021) instead of the existing empty-library message, distinguished by whether any filter param was present on the request.

## Consumers

- `frontend/src/pages/LibraryListPage.tsx` — gains the same shared filter component as Search, feeding `genre`/`style`/`format` into its existing page-fetching call.
- `frontend/src/services/libraryApi.ts` — request builder gains the three optional params (mirroring `discogsApi.ts`'s existing format handling).
- `backend/src/routes/library.ts` (`GET /`) — branches between the existing `libraryService.listEntries` call (no filters) and the new filtered path (`listAllEntries` + in-app filter + in-app paginate, research.md Decision 2) before calling `enrichEntries` on only the resulting page's items.

## Backward compatibility

Additive (Principle VI: MINOR). Existing callers that never send genre/style/format params are unaffected — same request/response shape and pagination source as today.
