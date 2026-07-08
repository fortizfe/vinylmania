# Contract: `GET /api/feeds/dashboard`

Mounted alongside the existing `/api/discogs`, `/api/library` routers in `backend/src/app.ts`. Requires authentication via the same `requireAuth` middleware used by every other `/api/*` route (matches the Dashboard's authenticated-route placement, see spec Assumptions).

## Request

```
GET /api/feeds/dashboard
Authorization: Bearer <firebase-id-token>
```

No query parameters in this MVP (category filtering, per spec User Story 3, is applied client-side over the single aggregate response — no server-side filter param needed given the small, capped payload size).

## Response — 200 OK

```jsonc
{
  "categories": [
    {
      "category": "News",
      "articles": [
        {
          "id": "https://metalinjection.net/?p=643474",
          "title": "DEVILDRIVER Unleash New Video For \"Strike And Kill\"",
          "excerpt": "Off their new album of the same name, out this Friday.",
          "imageUrl": "https://cdn-p.smehost.net/.../devildriver-2026-1024x576.jpeg",
          "publishedAt": "2026-07-07T21:17:03.000Z",
          "link": "https://metalinjection.net/new-music/devildriver-unleash-new-video-for-strike-and-kill",
          "sourceId": "metal-injection",
          "sourceName": "Metal Injection",
          "category": "News"
        }
        // ... up to 5 articles for this category
      ]
    }
    // ... one entry per non-empty category, e.g. "Reviews", "Interviews", "Tour Dates" when Metal Storm is reachable
  ],
  "sourceStatuses": [
    { "sourceId": "metal-injection", "sourceName": "Metal Injection", "status": "ok" },
    { "sourceId": "metal-storm-news", "sourceName": "Metal Storm", "status": "unavailable" }
    // ... one entry per configured+enabled source
  ],
  "generatedAt": "2026-07-08T08:40:00.000Z"
}
```

**Guarantees**:
- `categories` never includes an entry with an empty `articles` array (spec Edge Cases).
- Every `articles[]` entry has a non-empty `title` and `link` (unparseable/incomplete items are dropped upstream — see data-model.md validation rules).
- `sourceStatuses` always reflects every enabled configured source, even when its `status` is `"unavailable"` — this is how the frontend renders the non-blocking "source unavailable" notice (FR-007), and it is present even if `categories` is empty (e.g. every source down).
- If literally zero sources return data, `categories` is `[]` and every `sourceStatuses` entry is `"unavailable"` — HTTP status is still 200 (this is a valid, renderable "no content right now" state per FR-011, not a server error).

## Response — 401 Unauthorized

Standard shape reused from other routes when the bearer token is missing/invalid:

```json
{ "error": "unauthorized", "message": "Authentication required." }
```

## Response — 500 Internal Server Error

Only for genuinely unexpected failures (e.g. a bug in aggregation code) — NOT used for individual feed-source failures, which are absorbed into `sourceStatuses` per FR-007:

```json
{ "error": "internal_error", "message": "Something went wrong. Please try again." }
```

## Non-goals for this contract

- No pagination parameters — capped to top 3-5 per category server-side (FR-012).
- No per-source or per-category query filtering — the whole aggregate is always returned; filtering is a client-side concern (User Story 3).
- No write operations — this is a read-only aggregation endpoint.
