# Implementation Plan: RSS News View Redesign & Reliable Article Images

**Branch**: `067-rss-view-redesign` | **Date**: 2026-09-19 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/067-rss-view-redesign/spec.md`

## Summary

Two slices on the existing feeds domain, no new dependencies:

1. **Backend (US1, FR-001–FR-008, FR-010, FR-014)**: the rss-parser adapter
   starts reading Media RSS / iTunes / `content:encoded` fields; a generic,
   pure image-discovery ladder in the domain picks the image; items still
   without one get a bounded, SSRF-guarded, head-only article-page lookup for
   `og:image`/`twitter:image`, cached per article link for 7 days (including
   "none"); shared images (site logos) are dropped. The dashboard selection
   changes from "10 per category" to "last 7 days, ≥ 3 per source, ≤ 60,
   deduped". The API **shape is unchanged**.
2. **Frontend (US2–US4, FR-007–FR-017)**: the Dashboard's news board becomes
   the Portada layout (lead + 4 secondary tiles + "Latest" list) built by a
   pure slot-assignment function reused for the single-source view; the
   category filter and the status banner are removed; unavailable sources are
   marked on their filter chip; images fall back to a monogram placeholder.

Research and decision log: [research.md](./research.md) §1 (current state),
§3 (concepts), §5 (plan decisions D1–D14).

## Technical Context

**Language/Version**: TypeScript 5.6 — backend on Node (runtime v26 locally; Vercel function via `backend/api/index.ts`), frontend React 19 + Vite

**Primary Dependencies**: backend `express`, `axios` 1.18, `rss-parser` 3.13, `ioredis` (via `CachePort`); frontend `@tanstack/react-query` 5, Tailwind CSS v4, `clsx`, `motion` (not needed here). **No new dependencies.**

**Storage**: Redis through the existing `CachePort` (`adapters/cache/cacheAdapter.ts`): existing `feeds:<sourceId>` (20 min) + new `feeds:img:<articleLink>` (7 days). No Firestore changes.

**Testing**: backend Jest + nock (`backend/tests/{unit,contract,integration}/feeds`); frontend Vitest + RTL (`frontend/tests/...`); e2e Playwright + `@axe-core/playwright` (`e2e/tests/dashboard-feed-grid.spec.ts`).

**Target Platform**: Web (evergreen browsers, 360 px phones to wide desktop); backend as a Vercel serverless function.

**Project Type**: Web application (backend + frontend).

**Performance Goals**: warm view: no regression (lookups only run inside the 20-min source refresh). Cold source refresh: ≤ ~1 s added (8 lookups in parallel, 1 s timeout each) — SC-005.
*Was NEEDS CLARIFICATION (lookup blocking vs background) → resolved by clarify Q2 + research D5 (in-refresh; background work is unreliable on Vercel functions).*

**Constraints**: SSRF guard on every page-lookup hop (FR-004a, D3); 256 KB read cap; HTML-only; ≤ 3 redirects; no per-source config (FR-001); WCAG 2.1 AA (FR-016); reduced motion/transparency honoured.
*Was NEEDS CLARIFICATION (HTTP client for page lookup: axios vs global fetch) → resolved by D3 (axios: already installed, has a per-request `lookup` hook for IP pinning).*

**Scale/Scope**: 8 curated sources, ~290 items per refresh, ≤ 60 items rendered in the all-sources view; single-user-at-a-time traffic.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Gate | Result |
|---|---|---|
| I Test-First | Every task below has its failing test first (see Test strategy). | PASS |
| II Discogs | Not touched. | N/A |
| III YAGNI/KISS | 0 new deps; reuses `CachePort.withCache`, `shared/concurrency.ts`, axios, `pressable*`, `focusRing`, `Skeleton`; 2 new source files, each justified below; 3 files deleted. | PASS |
| IV SOLID | New capability added as one method on the existing `FeedSourcePort` (same adapter, same concern: reading remote feed content). Pure domain functions for rules. | PASS |
| V Observability | `feed_images_resolved` line per source refresh; SSRF refusals logged at `warn` (D13). | PASS |
| VI Versioning | `/api/feeds/*` response shape unchanged; semantics change (cap 10 → 60, 7-day window, better `imageUrl`) → **MINOR**. | PASS |
| VII News | Attribution + open original in new tab kept; per-source degradation kept (chip instead of banner). | PASS |
| VIII Hexagonal | `axios`, `rss-parser`, `dns`, `net` only in `adapters/feeds/`; parsing + selection in `domain/feeds/`; orchestration in `application/feeds/`; route unchanged. | PASS |
| IX Frontend → backend only | Frontend only calls `/api/feeds/*`; article images load via plain `<img src>` (explicitly out of scope of IX). Page lookups are server-side. | PASS |
| X WCAG 2.1 AA | See UI decisions → Accessibility; axe e2e in light + dark. | PASS |
| XI Apple design | `apple-design` + `emil-design-eng` consulted; decisions recorded below. | PASS |
| Stack: News source | "Unreachable feed skipped with a subtle notice" → chip marker satisfies it. | PASS |

No violations → Complexity Tracking empty.

## Project Structure

### Documentation (this feature)

```text
specs/067-rss-view-redesign/
├── plan.md              # This file
├── research.md          # §1 current state, §3 concepts, §5 plan decisions D1–D14
├── data-model.md        # Phase 1
├── quickstart.md        # Phase 1 validation scenarios
├── contracts/
│   └── feeds-api.md     # /api/feeds/* contract diff (shape unchanged, semantics changed)
├── checklists/requirements.md
└── tasks.md             # /speckit-tasks (not created here)
```

### Source Code (repository root)

```text
backend/src/
├── domain/feeds/
│   ├── types.ts                      # CHANGE: RawFeedItem gains enclosureType, mediaContent[], mediaThumbnails[], itunesImage, contentEncoded
│   ├── feedMapper.ts                 # CHANGE: extractImageUrl ladder (D2), extractPreviewImage(html, baseUrl) (D3), dropSharedPreviewImages (D6)
│   ├── selectDashboardArticles.ts    # NEW (D7): 7-day window, ≥3/source, ≤60, dedupe — pure business rule, own unit test
│   └── feedSources.ts                # unchanged
├── ports/feeds/feedSourcePort.ts     # CHANGE: + fetchArticleHead(url, timeoutMs): Promise<string | null>
├── adapters/feeds/
│   ├── feedSourceAdapter.ts          # CHANGE: parser customFields (D1); fetchArticleHead with DNS/IP guard, pinned lookup, manual redirects, stream head read (D3)
│   └── feedsRoutes.ts                # unchanged
├── application/feeds/getFeedsDashboard.ts  # CHANGE: page lookups via cache + mapWithConcurrency + per-refresh lookup counter (D4, D5), logo drop, injectable `now`, selectDashboardArticles replaces groupByCategory cap, dedupe per source, log line (D13)
└── config/logger.ts                  # CHANGE: + 'feed_images_resolved' outcome

backend/tests/
├── unit/feeds/domain/feedMapper.test.ts            # CHANGE
├── unit/feeds/domain/selectDashboardArticles.test.ts  # NEW
├── unit/feeds/adapters/feedSourceAdapter.test.ts   # CHANGE
├── unit/feeds/application/getFeedsDashboard.test.ts  # CHANGE
├── contract/feeds/feedsDashboard.contract.test.ts  # CHANGE (≤60, window, shape)
└── integration/feeds/feedsDashboard*.integration.test.ts  # CHANGE (media + og fixtures)

frontend/src/
├── lib/newsLayout.ts                 # NEW (D8, D10): assignPortadaSlots, formatArticleAge, sourceMonogram — pure presentation helpers
├── pages/DashboardPage.tsx           # CHANGE: drop banner, Portada skeleton, all-failed / empty states
├── components/FeedArticleBoard.tsx   # CHANGE: Portada layout, no category state, single-source reuse
├── components/FeedArticleCard.tsx    # CHANGE: variant 'lead' | 'tile' | 'row'; image + onError monogram placeholder
├── components/FeedArticleCardSkeleton.tsx  # CHANGE: variant prop matching the card variants
├── components/FeedSourceFilterBar.tsx      # CHANGE: unavailable chip (icon + text), one-row scrolling chip bar on phone
├── components/FeedCategoryFilterBar.tsx    # DELETE (D11)
└── components/FeedSourceStatusBanner.tsx   # DELETE (D12)

frontend/tests/
├── unit/newsLayout.test.ts                  # NEW
├── components/FeedArticleCard.test.tsx      # CHANGE
├── components/FeedArticleBoard.test.tsx     # CHANGE
├── components/FeedSourceFilterBar.test.tsx  # CHANGE
├── components/FeedCategoryFilterBar.test.tsx  # DELETE
├── unit/statusMessageEntrance.test.tsx      # CHANGE: drop the FeedSourceStatusBanner case
└── integration/dashboardPageFlow.test.tsx   # CHANGE

e2e/tests/dashboard-feed-grid.spec.ts        # CHANGE: broken image (US1), Portada layout, 390 px first screen, unavailable chip, axe light/dark
```

**Structure Decision**: web application; all work stays in the existing
`feeds` folders of each hexagonal layer and the existing `Feed*` components.
Only two new source files: `domain/feeds/selectDashboardArticles.ts` (a
distinct domain rule with its own tests, replacing application-layer
grouping) and `frontend/src/lib/newsLayout.ts` (pure helpers shared by the
board, cards and tests — keeps components render-only).

## Backend flow (per source refresh, inside the existing `feeds:<id>` 20-min cache)

1. `fetchFeed` → `RawFeedItem[]` (now with media/itunes/content:encoded).
2. `mapFeedItem` → `Article` with `imageUrl` from the feed ladder (D2); dedupe by link/id.
3. For articles without `imageUrl`, newest first, via `mapWithConcurrency(…, 8)`: `withCache('feeds:img:'+link, 7d, fetcher)`. The fetcher runs only on a cache miss and first increments a per-refresh `lookups` counter; once the counter reaches 8 the fetcher throws without fetching (not cached → retried next refresh). `mapWithConcurrency` bounds concurrency only; the counter bounds the total. Otherwise `fetchArticleHead(link, 1000)` → `extractPreviewImage` → URL or `null` (cached); rejection = transient, not cached, article keeps no image this refresh.
4. `dropSharedPreviewImages(lookupResults)` on the page-lookup results (link → url | null) before they are merged into articles (D6); emit `feed_images_resolved` (D13).
5. Dashboard: `selectDashboardArticles(all, now())`, with `now` injected into `createFeedsAggregationUseCase` (defaults to `() => new Date()`, D7) → wrapped as today's single `categories[0]` group. Source endpoint: all articles, deduped, newest first.

## UI decisions (Portada) — binding for frontend-agent

**Structure** (`FeedArticleBoard` → `<section aria-labelledby>`):
- Visually hidden `<h1>News</h1>` (Dashboard currently has none).
- Sticky source filter bar at top (`FeedSourceFilterBar`). Phone (< `sm`): a single row that scrolls horizontally inside itself (`flex-nowrap overflow-x-auto`); from `sm` it wraps. The page itself never scrolls horizontally.
- **Heading outline**: `h1` News (sr-only) → `h2` "Top stories" (sr-only) wrapping lead + tiles → lead and tile titles `h3` → `h2` "Latest" (visible) → row titles `h3`.
- **Top block**: phone: lead full width, then 2×2 grid of 4 secondary tiles. `lg` (≥1024 px): 12-col grid, lead `col-span-7`, secondaries in a 2×2 grid in `col-span-5` beside it.
- **Latest**: `<h2>Latest</h2>` + `<ul>`; one column on phone, two columns from `lg`.
- Title styles (all `h3`, per the outline above): lead title in the display font (`leading-display`/`tracking-display`, `text-2xl`→`lg:text-4xl`, 3-line clamp); tile titles (`text-base font-semibold`, 3-line clamp); row titles `h3` (`text-sm`/`text-base font-semibold`, 2-line clamp). Full title is the link's accessible name.
- Each card is one `<a target="_blank" rel="noopener noreferrer">` wrapping the whole card (existing `pressableCard`, `focusRing`); `<article>` semantics inside `<li>` for the list.

**Card variants** (`FeedArticleCard variant=`):
| Variant | Image box | Text | Meta |
|---|---|---|---|
| `lead` | `aspect-video`, eager, `fetchpriority="high"` | title + 2-line excerpt (hidden < `sm`) | source · age |
| `tile` | `aspect-video`, lazy | title | source · age |
| `row` | 72 px square (`sm`: 96 px), lazy | title | source · age |

- `<img alt="" decoding="async" referrerPolicy="no-referrer" loading=…>` inside a fixed-aspect box → no layout shift; `onError` swaps to the placeholder (D9).
- Meta line: `<span>{sourceName}</span> · <time>` (D10), `text-xs text-stone-600 dark:text-stone-400` (≥ 4.5:1 on both surfaces).

**States**:
- Loading: skeleton with the same variants (1 lead, 4 tiles, 6 rows).
- Single source selected: same Portada from `useSourceFeed` data; unavailable source → existing "temporarily unavailable" text.
- All sources unavailable → one empty state "News is temporarily unavailable. Please try again later."; healthy but empty → "No news right now — check back soon." (existing copy).
- Filter chip, unavailable: name + inline 16 px warning SVG (`aria-hidden`) + text "unavailable"; muted (`text-stone-600` / dark `text-stone-400`), still a 44 px `<button aria-pressed>`; selected state keeps `bg-primary` **and** `aria-pressed` (not colour only — existing).

**Materials & motion** (apple-design §12, emil-design-eng):
- Sticky filter bar: **opaque**, keeping today's `bg-white dark:bg-surface`. No translucency: `global.css` only has reduced-transparency/no-support fallbacks for overlays, not for this bar, so a translucent bar would need new fallback CSS (ponytail: not worth it).
- Press feedback only via existing `pressable`/`pressableCard` (`--motion-duration-press`).
- Filter change: no animation; content swaps instantly (FR-017). No per-card entrance, no stagger, no image zoom/parallax (seen tens of times/day → no decoration).
- Reduced motion: nothing extra needed; the only motion is the existing press feedback, already covered by the global guard.

**Accessibility (Principle X)**: list/heading structure above; tab order = visual order (lead → tiles → latest); focus ring on every card and chip; images decorative (`alt=""`, placeholder `aria-hidden`); relative time ("just now" / "25m ago" / "3h ago" / "2d ago" / "Sep 12") with the absolute date in `title` (hover) and sr-only text (AT); 44×44 targets; no page-level horizontal scroll at 320 px (chip row scrolls inside itself); contrast checked light/dark by axe e2e.

## Test strategy (Test-First, Principle I)

Order: domain unit → adapter unit → application unit → contract/integration → frontend lib → components → page flow → e2e. Each test is written and failing before its implementation task.

- **Domain**: ladder order per rung incl. `media:group` largest width, pixel skip, unsafe URLs; `extractPreviewImage` (property/name, attribute order, entities, relative URL, twitter fallback); `dropSharedPreviewImages`; `selectDashboardArticles` (window edge at exactly 7 d, ≥3/source with a 100-item source, cap 60, dedupe by link and by id).
- **Adapter**: customFields mapping from an HMO-like RSS fixture and an Atom fixture; resolver slower than the timeout rejects; `fetchArticleHead` with a fake resolver: private/loopback/link-local/metadata/IPv4-mapped refused (`null`), redirect to a private host refused, >3 redirects `null`, non-HTML `null`, 4xx `null`, 5xx/timeout rejects, stops at 256 KB / `</head>`.
- **Application**: lookups only for image-less articles; exactly 8 `fetchArticleHead` calls for a source with 18 image-less articles (counter, not concurrency, bounds it); unit tests inject `now`; cached `null` not re-fetched; rejection not cached; logo dropped; log line fields.
- **Contract/integration**: existing fixtures move from fixed July 2026 dates to dates relative to `Date.now()` (they go through the route's composition root, where `now` isn't injectable); the old ≤10 / length-10 assertions are replaced; dashboard response shape unchanged; ≤ 60 articles; none older than 7 days; source endpoint still uncapped.
- **Frontend lib**: `assignPortadaSlots` (lead newest-with-image, one per source, relax when single source, placeholders only in latest), `formatArticleAge` exact strings ("just now", "59m ago", "23h ago", "6d ago", "Sep 12" at 7 d, with `timeZone: 'UTC'`), monogram.
- **Components**: card variants, `onError` placeholder, `alt=""`; chip unavailable text + icon + still clickable; board single-source uses Portada.
- **E2E**: broken image → placeholder (US1); Portada visible at 390×844 (lead + ≥ 3 titles in viewport, no page horizontal scroll, chip bar one row), unavailable chip, source filter round-trip, axe 0 violations light + dark.

## Post-design Constitution re-check

Re-evaluated after data-model.md and contracts/: no new ports beyond one
method, no SDK in domain/application, response shape unchanged (MINOR), no
new dependencies, a11y and motion decisions recorded. **All gates PASS.**

## Complexity Tracking

None.
