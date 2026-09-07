# Contract: `GET /api/streaming/links`

Resolves the streaming-platform links for one record, against the caller's locale-derived
storefront. Additive, read-only. Always returns `200` on a well-formed request — a record that is
on no platform, and a total resolver outage, are both `{ "links": [] }` (the section must never
show an error).

## Request

`GET /api/streaming/links`

**Auth**: `requireAuth` (Vinylmania session `Authorization: Bearer <token>`), same as every other
`/api/*` route. This is the app session, **not** a Discogs link — the section is shown regardless of
whether the user linked Discogs (FR-020).

### Query parameters

| Param | Repeat? | Required | Description |
|---|---|---|---|
| `artist` | no | **yes** | Primary artist display name. `400` if missing/blank. |
| `title` | no | **yes** | Release or master title. `400` if missing/blank. |
| `barcode` | yes (0..n) | no | A `Barcode`-type identifier value from Discogs. Repeat the param for multiple. Absent for masters/older releases → text-search fallback only. |
| `locale` | no | no | BCP-47 tag from the browser (`navigator.language`), e.g. `es-ES`. Falls back to the `Accept-Language` header, then `ES`. |

Example:

```
GET /api/streaming/links?artist=Metallica&title=Master%20of%20Puppets&barcode=075596060721&locale=es-ES
```

## Response

### `200 OK` — always, for a well-formed request

```jsonc
{
  "links": [
    { "platform": "apple_music", "url": "https://music.apple.com/es/album/master-of-puppets/1440899482" }
  ]
}
```

- `links`: array, 0..n. One entry per platform that produced a **reliable** match.
  - `platform`: `"apple_music"` (future: `"spotify"`, `"amazon_music"`, `"deezer"`, `"tidal"`).
  - `url`: absolute `https://` album page. Safe to render as `<a href target="_blank" rel="noopener noreferrer">`.
- Order follows the server's resolver list (Apple Music first).
- `{ "links": [] }` when: no platform had a reliable match **or** every resolver failed transiently.
  The client renders nothing in both cases (it cannot and must not distinguish them — FR-014).

### `400 Bad Request` — malformed request only

```json
{ "error": "invalid_request", "message": "artist and title are required." }
```

Only for a missing/blank `artist` or `title`. Never used to signal "not found".

### `401 Unauthorized`

Standard session-missing/expired response from `requireAuth`. Handled by the existing `apiClient`
interceptor.

## Caching

- Per `(platform, recordKey, storefront)`, 90-day TTL, via the shared `CachePort` (`research.md`
  §5, `data-model.md`). A confirmed no-match is cached; a transient failure is not.
- The route itself sets no HTTP cache headers (parity with the other catalog routes).

## Logging (FR-019, Principle V)

One structured line per resolution attempt (not per cache hit):

```
logger.info({
  route: '/api/streaming/links',
  outcome: 'matched' | 'no_match' | 'transient_failure',
  platform: 'apple_music',
  method: 'barcode' | 'text',
  storefront: 'ES',
  uid: req.auth?.uid,
})
```

Plus one `logger.info` summary per request: `{ route, outcome: 'success', meta: { linkCount } }`.

## Rate limiting

- Standard Express per-IP `standardRateLimit` (same middleware the catalog routes use).
- Upstream (iTunes ~20 req/min) is handled inside the adapter (throttle + 90-day cache), never
  surfaced to the client as an error — a throttled upstream call just yields `{ "links": [] }` for
  that view and resolves on a later view.

## Contract test checklist (`backend/tests/contract/streaming/streamingLinks.contract.test.ts`)

- [ ] `200` + `{ links: [...] }` with a stubbed resolver that matches.
- [ ] `200` + `{ links: [] }` when the stubbed resolver returns `null`.
- [ ] `200` + `{ links: [] }` when the stubbed resolver throws `StreamingResolutionError`.
- [ ] `400 invalid_request` when `artist` or `title` is missing/blank.
- [ ] `401` without a session.
- [ ] Multiple `barcode` params are all forwarded to the resolver query.
- [ ] `locale` param → storefront; absent `locale` falls back to `Accept-Language`, then `ES`.
- [ ] Response contains no field other than `links` (no leakage of match method, scores, errors).
