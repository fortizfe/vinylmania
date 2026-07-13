# Contract: `GET /api/feeds/sources/:sourceId`

New endpoint for User Story 3. Existing `GET /api/feeds/dashboard`
(`backend/src/routes/feeds.ts`) is unchanged and not documented again here.

## Request

```
GET /api/feeds/sources/:sourceId
Authorization: <handled by existing requireAuth middleware, same as /api/feeds/dashboard>
```

- `sourceId` (path param, required): must match an `id` in `FEED_SOURCES`.

## Responses

### 200 OK — source known and enabled

```json
{
  "sourceId": "heavy-mag",
  "sourceName": "Heavy Mag",
  "status": "ok",
  "articles": [
    {
      "id": "string",
      "title": "string",
      "excerpt": "string",
      "imageUrl": "string | omitted",
      "publishedAt": "2026-07-13T10:00:00.000Z",
      "link": "https://...",
      "sourceId": "heavy-mag",
      "sourceName": "Heavy Mag",
      "category": "News"
    }
  ],
  "generatedAt": "2026-07-13T10:05:00.000Z"
}
```

- `articles` contains every article the source's feed currently has, sorted
  most-recent-first — no count cap is applied (see `research.md` §3,
  clarification in `spec.md`).
- `status: "ok"` with `articles: []` is valid and means the feed responded
  successfully but currently has no items — distinct from `"unavailable"`.
- `status: "unavailable"` with `articles: []` means the direct feed fetch
  failed or exceeded the existing per-source timeout
  (`DEFAULT_TIMEOUT_MS` in `feedClient.ts` — no new timeout is introduced).

### 404 Not Found — unknown or disabled sourceId

```json
{
  "error": "source_not_found",
  "message": "This source is not part of the current feed catalog."
}
```

Returned when `sourceId` does not match any entry in `FEED_SOURCES`, or
matches a `enabled: false` entry. Protects against a stale client-side
`sourceId` (e.g. referencing a source removed from the catalog).

### 500 Internal Server Error — unexpected server-side failure

Same shape and meaning as the existing `/api/feeds/dashboard` error
response (`{ "error": "internal_error", "message": "..." }`) — reserved for
failures unrelated to the requested feed itself (e.g. an unexpected
exception), not for the requested source being unreachable (that is
`status: "unavailable"` inside a 200, per above).

## Behavioral guarantees

- Idempotent, read-only, safe to retry.
- Reuses the same per-source cache entry (`feeds:${sourceId}`, 20-minute
  TTL) the general dashboard aggregation already populates/reads — a
  source that was just loaded as part of `/api/feeds/dashboard` will
  typically be served from cache here, not re-fetched from the network.
- Failure of this endpoint for one source has no effect on
  `/api/feeds/dashboard` or on any other source's availability
  (Constitution Principle VII).
