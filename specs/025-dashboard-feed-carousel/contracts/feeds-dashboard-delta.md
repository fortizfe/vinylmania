# Contract Delta: `GET /api/feeds/dashboard`

This feature does not add, remove, or restructure any endpoint. It extends the existing contract documented in [024's `feeds-dashboard.md`](../../024-rss-feed-dashboard/contracts/feeds-dashboard.md) — same route, same auth requirement (`requireAuth`, bearer Firebase ID token), same request shape (no query parameters), same field names in the response. Only the *data* returned changes:

- `categories[].articles` may now contain **up to 10** entries per category (was up to 5), sorted newest first.
- A category may now be populated by more than one contributing source merged together (e.g. `News` combining `metal-injection` and `metal-storm-news`); this was already legal per the original contract's grouping description, just not previously exercised by more than one source.
- `sourceStatuses` includes up to 5 additional entries, one per newly enabled Metal Storm source (`metal-storm-news`, `metal-storm-reviews`, `metal-storm-interviews`, `metal-storm-articles`, `metal-storm-picks`).

## Response — 200 OK (updated example)

```jsonc
{
  "categories": [
    {
      "category": "News",
      "articles": [
        {
          "id": "https://metalstorm.net/news/12345",
          "title": "New Metal Storm News Item",
          "excerpt": "...",
          "imageUrl": "https://metalstorm.net/.../cover.jpg",
          "publishedAt": "2026-07-08T09:00:00.000Z",
          "link": "https://metalstorm.net/news/12345",
          "sourceId": "metal-storm-news",
          "sourceName": "Metal Storm",
          "category": "News"
        },
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
        // ... up to 10 articles total for this category, combining both sources, newest first
      ]
    },
    { "category": "Reviews", "articles": [ /* up to 10, from metal-storm-reviews */ ] },
    { "category": "Interviews", "articles": [ /* up to 10, from metal-storm-interviews */ ] },
    { "category": "Articles", "articles": [ /* up to 10, from metal-storm-articles */ ] },
    { "category": "Staff Picks", "articles": [ /* up to 10, from metal-storm-picks */ ] }
  ],
  "sourceStatuses": [
    { "sourceId": "metal-injection", "sourceName": "Metal Injection", "status": "ok" },
    { "sourceId": "metal-storm-news", "sourceName": "Metal Storm", "status": "ok" },
    { "sourceId": "metal-storm-reviews", "sourceName": "Metal Storm", "status": "ok" },
    { "sourceId": "metal-storm-interviews", "sourceName": "Metal Storm", "status": "ok" },
    { "sourceId": "metal-storm-articles", "sourceName": "Metal Storm", "status": "ok" },
    { "sourceId": "metal-storm-picks", "sourceName": "Metal Storm", "status": "ok" }
  ],
  "generatedAt": "2026-07-08T09:05:00.000Z"
}
```

## Unchanged guarantees (carried over from 024)

- `categories` never includes an entry with an empty `articles` array.
- Every `articles[]` entry has a non-empty `title` and `link`.
- `sourceStatuses` always reflects every enabled configured source, even when `status` is `"unavailable"` for one of them — this still drives the existing non-blocking notice, now potentially naming any of the 6 enabled sources.
- No pagination parameters, no per-source/per-category query filtering, no write operations — all unchanged from 024's contract. The 10-item cap (was 5) is the only numeric change, and it applies to the *merged* category, not per source (see data-model.md).
