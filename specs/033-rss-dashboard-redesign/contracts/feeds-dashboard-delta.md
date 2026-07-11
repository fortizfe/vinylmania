# Contract Delta: `GET /api/feeds/dashboard`

This feature does not add, remove, or rename any endpoint or top-level response field. It extends the existing contract (024's `feeds-dashboard.md`, extended by 025's `feeds-dashboard-delta.md`) — same route, same auth requirement (`requireAuth`, bearer Firebase ID token), same request shape (no query parameters). Two additive changes only:

- Every entry in `sourceStatuses[]` gains a new `priority: boolean` field.
- `categories[].articles` may now include items from 2 new sources (`metalsucks`, `louder-sound`), merged into the existing `"News"` category alongside `metal-injection`, still subject to the unchanged 10-articles-per-category (post-merge) cap.

No filtering, sorting, or pagination query parameters are added — category/source filtering and recency sorting happen entirely client-side over this same payload (see research.md §1 and data-model.md's `FilterSelection`).

## Response — 200 OK (updated example)

```jsonc
{
  "categories": [
    {
      "category": "News",
      "articles": [
        {
          "id": "https://www.loudersound.com/features/some-article",
          "title": "Some Louder Sound Article",
          "excerpt": "...",
          "imageUrl": "https://www.loudersound.com/.../cover.jpg",
          "publishedAt": "2026-07-11T09:00:00.000Z",
          "link": "https://www.loudersound.com/features/some-article",
          "sourceId": "louder-sound",
          "sourceName": "Louder Sound",
          "category": "News"
        },
        {
          "id": "https://www.metalsucks.net/2026/07/11/some-post/",
          "title": "Some MetalSucks Post",
          "excerpt": "...",
          "imageUrl": "https://www.metalsucks.net/.../cover.jpg",
          "publishedAt": "2026-07-11T08:30:00.000Z",
          "link": "https://www.metalsucks.net/2026/07/11/some-post/",
          "sourceId": "metalsucks",
          "sourceName": "MetalSucks",
          "category": "News"
        }
        // ... up to 10 articles total for this category, combining metal-injection,
        // metalsucks, louder-sound (and metal-storm-news), newest first
      ]
    },
    { "category": "Reviews", "articles": [ /* unchanged, from metal-storm-reviews */ ] },
    { "category": "Interviews", "articles": [ /* unchanged, from metal-storm-interviews */ ] },
    { "category": "Articles", "articles": [ /* unchanged, from metal-storm-articles */ ] },
    { "category": "Staff Picks", "articles": [ /* unchanged, from metal-storm-picks */ ] }
  ],
  "sourceStatuses": [
    { "sourceId": "metal-injection", "sourceName": "Metal Injection", "status": "ok", "priority": true },
    { "sourceId": "metalsucks", "sourceName": "MetalSucks", "status": "ok", "priority": true },
    { "sourceId": "louder-sound", "sourceName": "Louder Sound", "status": "ok", "priority": true },
    { "sourceId": "metal-storm-news", "sourceName": "Metal Storm", "status": "ok", "priority": false },
    { "sourceId": "metal-storm-reviews", "sourceName": "Metal Storm", "status": "ok", "priority": false },
    { "sourceId": "metal-storm-interviews", "sourceName": "Metal Storm", "status": "ok", "priority": false },
    { "sourceId": "metal-storm-articles", "sourceName": "Metal Storm", "status": "ok", "priority": false },
    { "sourceId": "metal-storm-picks", "sourceName": "Metal Storm", "status": "ok", "priority": false }
  ],
  "generatedAt": "2026-07-11T09:05:00.000Z"
}
```

## Unchanged guarantees (carried over from 024/025)

- `categories` never includes an entry with an empty `articles` array.
- Every `articles[]` entry has a non-empty `title` and `link`.
- `sourceStatuses` always reflects every enabled configured source, even when `status` is `"unavailable"` — now potentially naming any of the 8 enabled sources, each additionally carrying its `priority` flag.
- No pagination parameters, no per-source/per-category query filtering, no write operations.

## New client-side contract (not part of the HTTP response — enforced in the frontend)

- The source filter's option list MUST be derivable from `sourceStatuses` alone: one option per entry (using `sourceName` as the label, `sourceId` as the value), with `priority: true` entries sorted before `priority: false` entries, each group preserving `sourceStatuses` array order.
- A selected category and a selected source combine with AND semantics over the flattened `categories[].articles` list; either or both may be `null` ("all").
