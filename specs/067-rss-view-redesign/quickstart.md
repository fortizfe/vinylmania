# Quickstart: validate 067

## Prerequisites

- Node matching the repo (`node -v`), dependencies installed in `backend/`, `frontend/`, `e2e/`.
- Firebase emulators available (backend and e2e test scripts start them).
- Optional: `backend/.env` `REDIS_URL`. Without it the cache is a no-op (fail-soft), which is fine for the tests. For local e2e, beware stale shared keys in the dev Redis; flush `feeds:*` if results look old.

## 1. Backend: image ladder, SSRF guard, selection, cache

```bash
cd backend
npm test -- tests/unit/feeds tests/contract/feeds tests/integration/feeds
```

Expected: all green. In particular:
- `feedMapper.test.ts`: the media:content, media:thumbnail, itunes:image, content:encoded and og:image rungs are resolved in spec order. A 1×1 `<img>` is skipped. `javascript:`/`data:`/relative URLs are ignored.
- `feedSourceAdapter.test.ts` (SSRF): with a fake resolver returning `10.0.0.5`, `127.0.0.1`, `169.254.169.254`, `::1`, `fd00:ec2::254` or `::ffff:127.0.0.1`, `fetchArticleHead` returns `null` and nock records **no** request. A public URL that 302-redirects to `http://169.254.169.254/` also returns `null`. A 4th redirect returns `null`. `application/json` returns `null`. A 5xx, a timeout, or a resolver slower than the timeout rejects. An Atom feed with `<link rel="enclosure">`/`media:thumbnail` is mapped too.
- `selectDashboardArticles.test.ts`: an article at `now − 7d − 1ms` is excluded and one at `now − 7d` is included. A source with 100 items cannot push out another source's 3 newest. The output has ≤ 60 items and no duplicate links or ids.
- `getFeedsDashboard.test.ts`: a source with 18 image-less articles triggers exactly 8 `fetchArticleHead` calls, and the other 10 are retried on the next refresh. A cached `null` means no second lookup. A rejected lookup is retried on the next refresh. A URL shared by 2+ page-lookup articles is dropped. One `feed_images_resolved` log line is emitted per source.

## 2. Live image coverage (SC-001) — manual, against the real feeds

```bash
cd backend
npx ts-node --transpile-only -e '
import { createFeedsAggregationUseCase } from "./src/application/feeds/getFeedsDashboard";
import { feedSourceAdapter } from "./src/adapters/feeds/feedSourceAdapter";
import { FEED_SOURCES } from "./src/domain/feeds/feedSources";
const cache = { has: async () => false, set: async () => {}, invalidate: async () => {}, withCache: (_k: string, _t: number, f: () => Promise<unknown>) => f() } as any;
const uc = createFeedsAggregationUseCase({ feedSource: feedSourceAdapter, cache });
(async () => { let all = 0, img = 0;
  for (const s of FEED_SOURCES) { const r = await uc.getSourceArticles(s.id); const n = r!.articles.length, k = r!.articles.filter(a => a.imageUrl).length;
    all += n; img += k; console.log(s.id.padEnd(22), r!.status, `${k}/${n}`); }
  console.log("TOTAL", `${img}/${all}`, (100 * img / all).toFixed(1) + "%"); })();'
```

Expected on a single cold run (the no-op cache turns every article into a cache miss, and the per-refresh counter allows 8 page lookups per source):
- `heavy-metal-overload` goes from 0 to ≈ 100 %.
- `femme-metal` is ≥ 12/18: about 4 images come from `content:encoded` and up to 8 from page lookups.
- `metal-underground` stays at 0 (logo discarded).

To check SC-001 in full, set `REDIS_URL` so lookup results persist, then run the script 3 times. Femme Metal reaches ≥ 90 % and TOTAL reaches ≥ 90 % (baseline 81.6 %, research.md §1.3).

## 3. Frontend units and components

```bash
cd frontend
npx vitest run tests/unit/newsLayout.test.ts tests/components/FeedArticleCard.test.tsx \
  tests/components/FeedArticleBoard.test.tsx tests/components/FeedSourceFilterBar.test.tsx \
  tests/integration/dashboardPageFlow.test.tsx
```

Expected:
- `assignPortadaSlots` puts the newest article with an image in the lead and uses at most one secondary tile per source. The rule relaxes when only one source is present. Placeholder-only articles appear only in `latest`.
- `formatArticleAge` returns exactly "just now" (30 s), "59m ago", "23h ago", "6d ago", and "Sep 12" at 7 days (the date test uses `timeZone: 'UTC'`).
- A card whose `<img>` fires `error` renders the monogram placeholder. Its image has `alt=""`.
- An unavailable chip shows the text "unavailable" plus an icon and stays clickable.
- There is no category filter in the DOM.

## 4. End-to-end: layout, filter, unavailable chip, a11y

```bash
cd e2e
npm test -- tests/dashboard-feed-grid.spec.ts
```

Expected (the backend is stubbed with `page.route('**/api/feeds/dashboard')` and `'**/api/feeds/sources/*'`):
- **390×844 viewport**:
  - the lead headline and at least 3 more article titles are inside the viewport without scrolling;
  - `document.documentElement.scrollWidth <= innerWidth`;
  - the chip bar is a single row (its height is one chip row) and scrolls horizontally inside itself.
- **1280×800 viewport**: the lead sits beside a 2×2 block of secondary tiles, with the Latest list below.
- **7-day window**: the stub contains no article older than 7 days. The contract and unit tests own the window itself; here only the rendering is checked.
- **Broken image**: an article whose `imageUrl` returns 404 shows the monogram placeholder, with no broken-image icon and no layout shift (the card's bounding box is unchanged).
- **Single source**:
  - clicking a source chip shows the same Portada, built only from that source;
  - clicking "All" restores the all-sources view;
  - the selected chip has `aria-pressed="true"`.
- **Unavailable source**:
  - with a `status: "unavailable"` source in the stub, its chip reads "… unavailable";
  - no element with `role="status"` banner copy is present;
  - clicking the chip shows "temporarily unavailable".
- **All sources unavailable**: a single empty-state message is shown.
- **Accessibility**: `runAxeScan` reports 0 violations in light and dark themes. Tab order runs from the chips to the lead, then the tiles, then the Latest list, with a visible focus ring on each.

## 5. Manual sanity check

With `npm run dev` running in `backend/` and `frontend/`, sign in, open the Dashboard and check:
- Heavy Metal Overload and Femme Metal articles show photos.
- Metal Underground articles show the "MU" monogram.
- Nothing older than 7 days appears in the all-sources view.
