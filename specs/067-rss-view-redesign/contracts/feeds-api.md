# Contract: `/api/feeds/*` (067 diff)

Both endpoints are unchanged in route, auth (`requireAuth`), rate limit,
status codes and **JSON shape**. Only the semantics below change, so this is
a **MINOR** version bump (Principle VI). Frontend types in
`frontend/src/services/feedsApi.ts` do not change.

## GET `/api/feeds/dashboard` → 200 `DashboardResponse`

```ts
interface DashboardResponse {
  categories: { category: string; articles: Article[] }[]; // today: exactly one group, "News"
  sourceStatuses: { sourceId: string; sourceName: string; status: 'ok' | 'unavailable'; priority: boolean }[];
  generatedAt: string; // ISO
}
interface Article {
  id: string; title: string; excerpt: string;
  imageUrl?: string;      // absolute http(s)
  publishedAt: string;    // ISO
  link: string; sourceId: string; sourceName: string; category: string;
}
```

| Aspect | Before (041/049) | After (067) |
|---|---|---|
| Articles per group | 10 newest | ≤ 60, published in the last 7 days, each available source's 3 newest guaranteed, newest first |
| Duplicates | possible (same link or guid) | none (dedupe by `link`, then `id`) |
| `imageUrl` sources | enclosure, first `<img>` in description | ladder D2 + article-page `og:image`/`twitter:image` (D3) minus shared/logo images (D6) |
| `imageUrl` guarantees | http(s) only | http(s) only (unchanged) |
| Sources with nothing in 7 days | could appear | absent from `categories`, still present in `sourceStatuses` |
| Empty `categories` | when no articles | when no articles in the window (unchanged meaning) |

Example (abridged):

```json
{
  "categories": [{ "category": "News", "articles": [
    { "id": "https://femmetal.rocks/2026/09/18/valkyries-fire-out-of-darkness-review/",
      "title": "Valkyrie's Fire – Out of Darkness Review",
      "excerpt": "Review of Valkyrie's Fire's debut album…",
      "imageUrl": "https://femmetal.rocks/wp-content/uploads/2026/06/Valkyries-Fire-….jpg",
      "publishedAt": "2026-09-18T10:00:00.000Z",
      "link": "https://femmetal.rocks/2026/09/18/valkyries-fire-out-of-darkness-review/",
      "sourceId": "femme-metal", "sourceName": "Femme Metal", "category": "News" },
    { "id": "http://www.metalunderground.com/news/details.cfm?newsid=162119",
      "title": "Cabal Tap Employed To Serve's Justine Jones For New Track \"Hurt Me\"",
      "excerpt": "Danish deathcore band Cabal…",
      "publishedAt": "2026-09-18T16:08:39.000Z",
      "link": "http://www.metalunderground.com/news/details.cfm?newsid=162119",
      "sourceId": "metal-underground", "sourceName": "Metal Underground", "category": "News" }
  ]}],
  "sourceStatuses": [
    { "sourceId": "metal-underground", "sourceName": "Metal Underground", "status": "ok", "priority": false }
  ],
  "generatedAt": "2026-09-19T09:00:00.000Z"
}
```

## GET `/api/feeds/sources/:sourceId` → 200 `SourceFeedResponse` | 404

Shape unchanged. Articles are **not** windowed or capped (FR-013). They are now deduplicated, and their `imageUrl` values come from the same ladder as the dashboard. Newest first.

## Internal port contract (backend, not HTTP)

```ts
interface FeedSourcePort {
  fetchFeed(feedUrl: string, timeoutMs?: number): Promise<RawFeedItem[]>;       // unchanged signature; richer RawFeedItem
  /** HTML <head> (≤ 256 KB) of a public http(s) page, following ≤ 3 redirects with
   *  a DNS/IP check on every hop. null = definitive "no page" (blocked address,
   *  non-HTML, 4xx, too many redirects). Rejects on transient failure (timeout,
   *  network, 5xx). */
  fetchArticleHead(url: string, timeoutMs: number): Promise<string | null>;     // NEW
}
```
