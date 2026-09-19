# Research: RSS View Redesign (067)

**Date**: 2026-09-19 · **Phase**: specify · **Spec**: [spec.md](./spec.md)

This document holds (1) the verified current state of the news view and why
images are missing, (2) the RSS-reader UX research, and (3) the three UX
concepts the user will choose from. The concept choice is the single open
`[NEEDS CLARIFICATION]` in spec.md.

---

## 1. Current state

### 1.1 Where the code lives

| Layer | File | Role today |
|---|---|---|
| Domain | `backend/src/domain/feeds/feedSources.ts` | Static catalog of 8 sources (`id`, `name`, `feedUrl`, `category`, `enabled`, `priority`). Already config-driven: adding a source is one entry. |
| Domain | `backend/src/domain/feeds/feedMapper.ts` | `mapFeedItem` → `Article`. `extractImageUrl` checks **only** `enclosure.url`, then the first `<img src>` in `content`/`summary`. |
| Domain | `backend/src/domain/feeds/types.ts` | `RawFeedItem` exposes only `enclosureUrl` as an image-bearing field. |
| Adapter | `backend/src/adapters/feeds/feedSourceAdapter.ts` | `new Parser()` (rss-parser) **with no `customFields`** → `media:content`, `media:thumbnail`, `media:group`, `itunes:image` are never read. |
| Application | `backend/src/application/feeds/getFeedsDashboard.ts` | Fetches sources in parallel (20 min cache per source), groups by category, **keeps 10 articles per category**. |
| Frontend | `frontend/src/pages/DashboardPage.tsx`, `components/FeedArticleBoard.tsx`, `FeedArticleCard.tsx`, `FeedArticleCardSkeleton.tsx`, `FeedCategoryFilterBar.tsx`, `FeedSourceFilterBar.tsx`, `FeedSourceStatusBanner.tsx`, `queries/feedsQueries.ts`, `services/feedsApi.ts` | Uniform 1–5 column grid of equal cards, two chip bars (category + source), amber banner for unavailable sources. |

### 1.2 Usability problems found in the current view

1. **Only 10 articles total.** All 8 sources share category `News`, so the
   "10 per category" cap means the whole view shows the 10 newest items across
   all sources. A burst from one prolific source (Heavy Mag publishes 100 items
   per feed) can push every other source off the page.
2. **Category filter is dead weight.** There is exactly one category, so the
   first chip bar offers "All" vs "News" — the same list.
3. **No hierarchy.** Every card has the same size, weight and height
   (`sm:h-96`), so nothing guides the eye; the desktop grid at 5 columns shows
   5 titles per row truncated to 2 lines.
4. **Absolute dates only** ("Sep 18, 2026") — freshness must be computed by
   the reader.
5. **Missing image = empty grey box** (`feed-article-thumbnail-placeholder`),
   indistinguishable from a still-loading or broken image. A broken image URL
   renders the browser's broken-image glyph (no `onError` handling).
6. **Accessibility nit:** `<img alt={article.title}>` next to the visible
   `<h3>` title makes screen readers announce the title twice (the image is
   decorative in this context and should have empty alt).

### 1.3 Why images fail — verified against the live feeds (2026-09-19)

All 8 configured feeds were fetched (HTTP 200) and parsed with the project's
own `rss-parser` install, once with the current logic and once with the
Media-RSS fields enabled. Article pages were fetched for sources without any
image in the feed.

| Source | Items | Image found by current logic | Where the image actually is | Verdict |
|---|---|---|---|---|
| Metal Injection | 25 | 25 | `<img>` in item HTML | OK |
| MetalSucks | 50 | 50 | `<img>` in item HTML | OK |
| Louder Sound | 50 | 50 | `enclosure` + `media:content` + `media:thumbnail` | OK |
| Heavy Mag | 100 | 100 | `<img>` in item HTML | OK |
| MetalTalk | 10 | 10 | `<img>` in item HTML | OK |
| **Heavy Metal Overload** | 10 | **0** | `media:content` / `media:thumbnail` only | **Fails: parser never reads Media RSS** |
| **Femme Metal** | 18 | **0** | Nothing usable in the feed (`<img>` in `content:encoded` for only 4/18, not the lead image); article page has a per-article `og:image` (1200 px) | **Fails: no page-level fallback** |
| **Metal Underground** | 25 | **0** | Nothing in the feed; article page `og:image` is the site's generic logo (`horns-512.png`), identical for every article | **Unrecoverable → needs a designed fallback** |

- Today: 235 / 288 items (81.6 %) and 5 / 8 sources have images.
- Reading Media RSS fields: 245 / 288 (85 %), 6 / 8 sources.
- Plus article-page `og:image` fallback: 263 / 288 (91.3 %), 7 / 8 sources.
- Metal Underground (25 items) can only get a designed, source-branded
  fallback — its only page image is a site logo, which must be rejected
  (an image identical across all of a source's items is not an article image).
- Every discovered image URL returned HTTP 200 with a foreign `Referer`
  (no hotlink blocking) for the sampled items of all 6 image-bearing sources.
- 2026-09-19 SC-001 measured (T051; quickstart §2 script, 3 runs, `feeds:img:*` persisted in dev Redis, `feeds:<id>` bypassed): TOTAL 256/288 (88.9 %) → 261/288 (90.6 %) → 263/288 (91.3 %) — target ≥ 90 % met from run 2; Femme Metal 11/18 → 16/18 → 18/18 (lookup timeouts 1, 2, 0); Metal Underground 0/25 every run (designed placeholder, by design); Metal Injection 25/25, MetalSucks 50/50, Louder Sound 50/50, Heavy Mag 100/100, Heavy Metal Overload 10/10, MetalTalk 10/10 every run.

Note: spec 024's research already intended to read `media:content`, but the
adapter was never given `customFields`, so the intent never reached the code.

### 1.4 Generic image discovery order (proposed, for the plan)

Stop at the first candidate that is an absolute `http(s)` URL:

1. `enclosure` whose type is an image (or has no type but an image extension)
2. `media:content` (medium="image" or image type; largest width when several), incl. inside `media:group`
3. `media:thumbnail`
4. `itunes:image`
5. First `<img src>` in `content:encoded`, then `description`/`summary`
6. Article page `og:image` → `twitter:image` — only for items that reached
   this rung, bounded in count and time, cached with the feed, and **discarded
   when the same URL is returned for every item of that source** (site logo).
7. No image → the view shows the designed source-branded fallback.

All of rungs 1–5 are feed fields; rung 6 is the only new network work.

---

## 2. UX research

| Product | Pattern worth taking | Pattern to avoid |
|---|---|---|
| **Feedly** | Three densities (title-only / magazine / cards); title-only lets you scan 50 items in < 2 min. | Too many view toggles for a single-purpose page. |
| **Inoreader** | Magazine view = image + text balance; List view recommended for frequently-updated news. | Five views → choice paralysis. |
| **Reeder (2024)** | One unified, chronological timeline; no unread counts; position is the state. Calm. | Sync of scroll position across devices (overkill here). |
| **NetNewsWire** | Scan titles + small image + preview line; smart feed "Today". | Three-pane layout on mobile. |
| **Readwise Reader** | — | Built for deep read-later, not fast triage. |
| **Google News** | Top story expanded, the rest collapsed to one headline; clusters dedupe the same event across publishers. | Clustering requires similarity scoring (out of scope). |
| **Techmeme / River** | Headline-dense, reverse chronological "river"; big cluster = big story. | Text-only, no images. |
| **Flipboard / Apple News** | Magazine layouts driven by designer templates; hero image 60–70 % of card; pacing and rhythm. | Page-flip gesture, heavy layout engine. |
| **Metal news sites (Louder, Blabbermouth, Loudwire)** | Lead story + secondary tiles + "latest" list; strong photography. | Ad-driven clutter. |

Apple design constraints applied to every concept (skills `apple-design`,
`emil-design-eng`): clarity and hierarchy through size/weight rather than
decoration; relative time for freshness; press feedback on pointer-down
(existing `pressable`/`pressableCard` helpers); sticky filter bar (kept
opaque in the plan, D14); no animation on frequent actions beyond press
feedback (the filter-change fade was later dropped, D14); `prefers-reduced-motion` honored; 44×44 px targets; no carousels
(spec 033 removed them deliberately because they hide content behind
interaction).

---

## 3. The three concepts

All three share: one list of the newest articles across all sources (not 10
total), a single source filter (category filter removed), relative time,
source-branded image fallback, inline per-source availability notice, tap
opens the original article in a new tab (Principle VII).

### Concept A — "Portada" (Front Page)

**Pitch.** The news view becomes a magazine front page: the freshest story
with a real image is the lead (large photo, big headline), 2–4 secondary
stories sit beside it as medium tiles, and everything else flows below as a
compact "Latest" list with small thumbnails. You understand what happened
today from the first screen without scrolling.

**Inspiration.** Apple News, Flipboard, Google News top story, Louder /
Loudwire home pages, Inoreader magazine view.

**Layout.**
- Desktop (≥ 1024 px): 12-column bento. Lead spans 8 cols (16:9 photo,
  title 3 lines, excerpt 2 lines); right rail stacks 2 secondary tiles; below,
  a 3-column band of secondary tiles, then a 2-column "Latest" list.
- Mobile: lead full-width (photo 16:9), then 2 secondary tiles as a 2-up
  row, then a single-column compact list (72 px square thumbnail left).

```
Desktop                                     Mobile
+--------------------------+-----------+    +------------------+
| [ LEAD PHOTO 16:9      ] | [img] S1  |    | [ LEAD PHOTO   ] |
|                          | title...  |    | Lead headline    |
| LEAD HEADLINE, 3 LINES   +-----------+    | Source · 2 h     |
| Excerpt two lines...     | [img] S2  |    +--------+---------+
| Source · 25 min          | title...  |    |[img] S1|[img] S2 |
+--------+--------+--------+-----------+    |title.. |title..  |
| [img]  | [img]  | [img]  |                +--------+---------+
| S3     | S4     | S5     |                |[im] title 2 lines|
+--------+--------+--------+-----------+    |     Source · 3 h |
| LATEST                               |    |[im] title 2 lines|
| [im] Title .......... Source · 3 h   |    |     Source · 5 h |
| [im] Title .......... Source · 4 h   |    +------------------+
+--------------------------------------+
```

**Interactions.** Scroll + tap. Source chips at top. No toggles.

**Items without image.** Never eligible for lead or secondary slots; they
go to the Latest list with the source-branded monogram tile.

**Strengths.** Highest visual impact; clear hierarchy; photography of the
genre shines; first screen is a summary.

**Trade-offs / risks.** "Lead" = freshest-with-image, not most important
(no importance signal exists) — can promote a trivial post. Slot-assignment
logic and 3 layouts to test. A prolific source can dominate the top slots.
Lowest headline density above the fold.

### Concept B — "Río" (Timeline)

**Pitch.** One calm, chronological river of headlines grouped under sticky
day headers ("Today", "Yesterday", "Tue 16 Sep"). Each row is a fixed-rhythm
line: small square image, headline up to 3 lines, source and relative time.
Scanning 20+ headlines takes one flick of the thumb; freshness is obvious
from position and the day header.

**Inspiration.** Reeder unified timeline, NetNewsWire, Techmeme River,
Feedly title-only / Inoreader list view.

**Layout.**
- Desktop: centred reading column (max ~ 760 px) with a sticky left or top
  source list showing each source's name and availability; rows with 96 px
  image, title (semibold, 3 lines), one-line excerpt, meta line.
- Mobile: same list full-width, 72 px image on the left, excerpt hidden,
  source chips in a sticky translucent bar.

```
Desktop                                          Mobile
+-----------+----------------------------------+ +---------------------+
| SOURCES   | TODAY                            | |(All)(Louder)(MI)... |
| All    ●  | [img] Deftones' Chino Moreno ... | +---------------------+
| Louder ●  |       One-line excerpt ....      | | TODAY               |
| MI     ●  |       Metal Injection · 25 min   | |[im] Headline over   |
| M.Und. ○  | [img] Dirty Honey announce third | |     three lines max |
|  (down)   |       ... MetalTalk · 2 h        | |     MetalTalk · 2 h |
|           | YESTERDAY                        | |[MU] Headline ...    |
|           | [MU ] Cabal tap Employed To ...  | |     Metal Und. · 1 d|
|           |       Metal Underground · 1 d    | | YESTERDAY           |
+-----------+----------------------------------+ +---------------------+
```

**Interactions.** Scroll + tap; one-tap source filter. Nothing else.

**Items without image.** The same-size square shows the source monogram on
the source's tint — rhythm never breaks, and the source is recognisable at a
glance.

**Strengths.** Densest and fastest to scan (≈ 2–3× more headlines per screen
than today on mobile); simplest to build and test (one row component, one
list); degrades perfectly when images are missing; closest to Apple
"clarity and restraint".

**Trade-offs / risks.** Least "wow"; photography is small; no notion of a
big story. Needs a sensible item count so the river is not endless.

### Concept C — "Quiosco" (Newsstand by source)

**Pitch.** Each source gets its own panel, like publications on a newsstand:
its newest story with a large image at the top of the panel and its next
4 headlines below. Panels are arranged in a responsive masonry. You see what
every outlet is saying right now, at once, with zero taps; a source that is
down shows its state inside its own panel.

**Inspiration.** Techmeme's multi-source layout, popurls/newsstand
dashboards, NetNewsWire per-feed view, the current source filter (041)
turned into the primary layout.

**Layout.**
- Desktop: 3-column masonry of source panels ordered by most recent
  publication (priority sources first on ties).
- Mobile: single column of panels; each panel shows lead + 3 headlines and a
  "More from <source>" link that applies the source filter.

```
Desktop
+-----------------+-----------------+-----------------+
| LOUDER SOUND  2h| METAL INJECTION | METALTALK   2 h |
| [ lead photo  ] | [ lead photo  ] | [ lead photo  ] |
| Lead headline   | Lead headline   | Lead headline   |
| · headline  3 h | · headline 1 h  | · headline  5 h |
| · headline  5 h | · headline 3 h  | · headline  1 d |
| More ->         | More ->         | More ->         |
+-----------------+-----------------+-----------------+
| METAL UNDERGR.  | FEMME METAL     | HEAVY MAG       |
| (temporarily    | [ lead photo  ] | ...             |
|  unavailable)   | ...             |                 |
+-----------------+-----------------+-----------------+
```

**Interactions.** Scroll + tap; "More" per panel (replaces the filter
chips).

**Items without image.** Panel lead shows the branded tile; headlines below
are text-only by design.

**Strengths.** Every source always visible (fixes the "one source floods the
page" problem structurally); availability shown in context instead of a
banner; strong brand identity per outlet.

**Trade-offs / risks.** No global chronology — the newest story overall may
sit in the 6th panel; the same event covered by several outlets appears
several times; long page on mobile with 8+ sources; as sources grow, the
panel count grows linearly.

### Recommendation

**Concept B (Río)** best serves "see the news clearly with little
interaction": highest headline density, freshness readable at a glance,
immune to missing images, and the smallest build/test surface (Principle
III). Choose A if visual impact matters more than scan speed; choose C if
per-outlet coverage matters more than chronology.

**Decision (2026-09-19):** the product owner chose **Concept A (Portada)**. B and C are not built.

---

## 4. Rejected alternatives (one line each)

- Horizontal carousels per category/source — removed in 033 because they hide content behind arrows.
- Two-pane reader with in-app preview — adds a step per article and the preview can only show an excerpt (Principle VII forbids reproducing content).
- Read/unread state or "new since last visit" — needs per-user persistence; add when users ask to track what they've read.
- Cross-source story clustering (Google News style) — needs similarity scoring; add if duplicate coverage becomes a real complaint.
- User-managed sources (add your own feed URL) — sources stay curated by the owner (constitution: rock/metal curation); add if multi-user curation is requested.
- Proxying/re-hosting images through the backend — images load fine hotlinked; add if a source starts blocking hotlinks.
- View-mode toggle (list/cards/magazine) — one good default beats three options; add only if feedback splits.
- Infinite scroll / pagination — a bounded recent window is enough for news; add if users scroll to the end regularly.

## 5. Plan decisions (Phase 0, 2026-09-19)

Resolves every Technical Context unknown in plan.md. Format: Decision /
Rationale / Alternatives rejected (one line each).

### D1 — Read Media RSS and iTunes fields via rss-parser `customFields`
- **Decision**: construct the parser once with `customFields.item`: `['media:content','mediaContent',{keepArray:true}]`, `['media:thumbnail','mediaThumbnail',{keepArray:true}]`, `['media:group','mediaGroup']`, `['itunes:image','itunesImage']`. `content:encoded` is already exposed by rss-parser as `item['content:encoded']` but is **not mapped today** — the adapter maps it too. The adapter translates these into domain-owned `RawFeedItem` fields (spec 049 FR-012 preserved).
- **Rationale**: verified locally — without `customFields` Heavy Metal Overload yields 0 images; with them 10/10. `content:encoded` holds Femme Metal's album artwork for some items (rss-parser's `content` is the `<description>` there).
- **Alternatives**: hand-rolled XML traversal (new code, already rejected in 024); `fast-xml-parser` as a direct dependency (new dep for what 4 config entries do).

### D2 — Image discovery order (pure, domain)
- **Decision**: `extractImageUrl(item)` in `domain/feeds/feedMapper.ts` walks: image enclosure (type `image/*`, or no type + image extension) → `media:content` incl. `media:group` (prefer `medium="image"`/`image/*`; largest `width` wins) → `media:thumbnail` → `itunes:image@href` → first `<img>` in `content:encoded` → first `<img>` in `content`/`summary` → none. `<img>` with a `width` or `height` attribute < 50 is skipped (tracking pixels). Only absolute `http(s)` URLs pass (existing `SAFE_IMAGE_URL_PATTERN`). The article-page step (FR-003 last rung) is orchestrated in the application layer (D3/D5) because it needs I/O.
- **Rationale**: one generic function, no per-source rules (FR-001); order matches spec FR-003.
- **Alternatives**: per-source image strategy config (violates FR-001); largest-image-by-HEAD-request (network per image, YAGNI).

### D3 — Article-page lookup: axios + stdlib DNS guard, head-only read
- **Decision**: new method on the existing `FeedSourcePort`: `fetchArticleHead(url, timeoutMs): Promise<string | null>`, implemented in `adapters/feeds/feedSourceAdapter.ts` with **axios (already installed)**:
  - protocol must be `http:`/`https:`;
  - resolve the hostname with `dns.promises.lookup(host, {all:true})`; if **any** address is in a `net.BlockList` (stdlib) of IPv4 `0/8, 10/8, 100.64/10, 127/8, 169.254/16` (incl. metadata `169.254.169.254`)`, 172.16/12, 192.0.0/24, 192.168/16, 198.18/15, 224/4, 240/4` and IPv6 `::/128, ::1/128, fc00::/7` (incl. `fd00:ec2::254`)`, fe80::/10`, IPv4-mapped `::ffff:0:0/96` (checked against the v4 list) → refuse;
  - the request pins the validated address through axios' `lookup` option (no DNS-rebinding window);
  - `maxRedirects: 0`; the adapter follows up to 3 redirects itself, re-running the protocol + DNS check on every hop;
  - the whole lookup (all hops) shares one `AbortSignal.timeout(timeoutMs)`;
  - `responseType: 'stream'`; refuse unless `content-type` is `text/html` or `application/xhtml+xml`; read until `</head>`, an `og:image`/`twitter:image` match, or **256 KB**, then destroy the stream;
  - returns: HTML head text; `null` = **definitive** no page (blocked address, non-HTML, 4xx, too many redirects); **rejects** = transient (timeout, network, 5xx).
  - DNS resolution is raced against the same timeout signal, so a slow resolver also rejects within `timeoutMs`;
  - the DNS resolver is an injectable parameter (`resolve`) so unit tests (nock) never hit real DNS. The feeds composition root (`feedsRoutes.ts`) imports the `feedSourceAdapter` module object directly, with no factory, so route-level integration tests use `jest.mock('node:dns')` instead (spreading `jest.requireActual` and overriding only `promises.lookup` to return a public IP such as `93.184.216.34`). The adapter imports DNS from the same `node:dns` specifier.
  - Parsing `og:image` → `twitter:image` (`<meta property|name=… content=…>`, either attribute order, entity-decoded, absolute http(s) only, relative resolved against the final URL) is a pure domain function `extractPreviewImage(html, baseUrl)` in `feedMapper.ts`.
- **Rationale**: axios is already the feeds HTTP client and supports `lookup`/`maxRedirects`/stream; `net.BlockList` and `dns` are stdlib — zero new deps. Measured Femme Metal: `og:image` at byte ~7 KB, `</head>` at 153 KB, TTFB ≈ 0.5 s, so a head-only read fits the budget.
- **Alternatives**: Node global `fetch` (no per-request `lookup` hook → cannot pin the validated IP without an undici `Agent`, i.e. a new dependency surface); `ssrf-req-filter`/`request-filtering-agent` (new dep for ~30 lines of stdlib); allow-listing article host = feed host (breaks Feedburner sources, rejected in clarify Q1).

### D4 — Per-link lookup cache: existing `CachePort.withCache`, 7-day TTL
- **Decision**: `cache.withCache('feeds:img:' + articleLink, 604800, () => lookup(link))`. The fetcher returns the image URL or `null`; `null` is cached (`JSON.stringify(null)` round-trips through `cacheAside`), so "no image found" is remembered (clarify Q2). A **rejected** fetcher is not cached by `cacheAside`, so transient failures retry on the next source refresh. Redis is what the feeds code already uses (`feeds:<sourceId>`, 20 min) via `adapters/cache/cacheAdapter.ts`; it's fail-soft when Redis is absent (tests, local).
- **Rationale**: zero new cache code; single-flight coalescing comes for free.
- **Alternatives**: storing results inside the 20-min `feeds:<id>` blob (loses them every refresh → ~43 page fetches / 20 min); Firestore (user-state store, wrong tier per constitution).
- **ponytail**: TTL is fixed at 7 days rather than "while the article is in the feed" — a dropped article's key simply expires unused. Ceiling: none practical.

### D5 — Lookup budget: cap 8 per source refresh, all concurrent, 1 s timeout
- **Decision**: after mapping a source's items, take articles with no feed image, newest first. Cache hits are free. The total is capped by an explicit per-refresh counter inside the `withCache` fetcher, which runs only on a cache miss: the fetcher increments `lookups`; once 8 have started it throws without fetching, so the miss is not cached and retries on the next refresh. `shared/concurrency.ts#mapWithConcurrency` with limit 8 only bounds concurrency (it processes every item), so on its own it would not cap the total. Each lookup uses `timeoutMs = 1000`. Lookups run inside the existing `feeds:<id>` `withCache` fetcher, so they only happen on a source refresh (every 20 min), never on a warm view.
- **Rationale**: sources are fetched in parallel, so the cold-load delta is bounded by ~1 s (SC-005). With per-link caching, Femme Metal's 18 items are covered in ≤ 3 refreshes; Metal Underground's 25 resolve to `null`/logo once and are never re-fetched for 7 days.
- **Alternatives**: background lookups after the response (backend runs as a Vercel function — work after the response is not guaranteed without a new `waitUntil` dependency); unbounded lookups (politeness + budget).
- **ponytail**: 1 s per page; a publisher whose article pages consistently take > 1 s stays on placeholders. Upgrade path: raise the timeout for cold refreshes or warm lookups from a scheduled job.

### D6 — Logo discard rule (FR-005)
- **Decision**: pure domain function `dropSharedPreviewImages(results: Map<string /* article link */, string | null>): Map<string, string | null>`. Its input is the page-lookup results of one source refresh (cached and fresh), before they are merged into articles, so feed-ladder images are never involved. Any URL used by ≥ 2 different links is replaced by `null` for all of them (→ placeholder). The application then merges the map into the image-less articles.
- **Rationale**: Metal Underground returns `horns-512.png` for every article; a per-article image is by definition unique.
- **ponytail**: a source with exactly one page-lookup article cannot be detected. Ceiling accepted; upgrade: remember a per-source known-logo URL.

### D7 — Recent window, fairness, dedupe: pure domain function in the backend
- **Decision**: new `domain/feeds/selectDashboardArticles.ts#selectDashboardArticles(articles, now)`: dedupe by `link` then `id` (keep first/newest), keep `publishedAt >= now − 7 d`, guarantee each source its 3 newest in-window, fill up to 60 by recency, return newest-first. `getFeedsDashboard.ts` replaces its `groupByCategory` 10-cap with it; the per-source endpoint keeps returning all articles (FR-013), deduped.
- **Time source**: `createFeedsAggregationUseCase` gains an optional `now?: () => Date` dependency (default `() => new Date()`), matching the existing optional `feedSources` test override. Unit tests inject a fixed `now`. Contract and integration tests go through `feedsRoutes.ts`' module-level composition root, where `now` can't be injected, so their fixtures use dates relative to `Date.now()`. Jest fake timers were rejected because they interfere with nock/axios timeouts.
- **Rationale**: business rule, belongs in domain; testable without I/O; keeps the payload small.
- **Alternatives**: selecting in the frontend (ships up to 288 articles to the browser, duplicates a rule the backend already owns).

### D8 — Portada slot assignment: pure frontend function
- **Decision**: `frontend/src/lib/newsLayout.ts#assignPortadaSlots(articles)` → `{ lead, secondary[≤4], latest[] }`, per FR-009: lead = newest with `imageUrl`; secondary = next newest with `imageUrl`, max one per source while other sources still have candidates (second pass relaxes the rule — this is what makes the single-source view work unchanged, clarify Q4); everything else → `latest` newest-first. Same function for the all-sources and single-source data.
- **Rationale**: slots are presentation, not domain; both endpoints feed it; pure → trivial Vitest.
- **Alternatives**: backend assigns slots (couples API to one layout; single-source endpoint would need it too).
- **Note**: an image that fails to load *in the browser* keeps its slot and shows the placeholder (FR-007); re-slotting after `onError` would reflow the page (layout shift). Accepted.

### D9 — Source-branded placeholder without per-source config
- **Decision**: neutral surface (`stone-100` / dark `stone-800`) with a 1–2 letter monogram of the source name (initials of the first two words, e.g. "MU", "HM"), `aria-hidden`, same box as the image (`aspect-ratio`), rendered when `imageUrl` is missing **or** the `<img>` fires `onError`. Lives inside `FeedArticleCard.tsx`.
- **Rationale**: FR-001 forbids per-source settings; neutral + monogram always meets contrast; source name is already in the meta line for AT.
- **Alternatives**: hashed per-source tint (6 tokens × 2 themes to contrast-check for marginal gain); favicon fetch (network + FR-001 creep).

### D10 — Relative time: hand-formatted compact strings
- **Decision**: `formatArticleAge(iso, now)` in `lib/newsLayout.ts` returns exactly: `< 1 min` → "just now"; `< 60 min` → "{m}m ago"; `< 24 h` → "{h}h ago"; `< 7 d` → "{d}d ago" (all floored); `≥ 7 d` → `toLocaleDateString('en', { month: 'short', day: 'numeric' })`, e.g. "Sep 12". Rendered as `<time dateTime={iso} title={fullDate}>` (hover) plus an `sr-only` full date (AT). Computed at render; no ticking timer (react-query refetch on focus refreshes it).
- **Rationale**: `Intl.RelativeTimeFormat` `narrow` gives similar output ("25m ago") but varies with each browser's CLDR data and mixes in "yesterday". Four hand-written branches are as short, deterministic and trivially testable.
- **Alternatives**: `Intl.RelativeTimeFormat` (above); date-fns/dayjs (new dep for one function); live-updating clock (YAGNI).

### D11 — Remove the category filter (frontend only)
- **Decision**: delete `FeedCategoryFilterBar.tsx` and its test; drop category state from `FeedArticleBoard.tsx`. Backend keeps `category` in `FeedSourceConfig`/`Article` and the `categories[]` response wrapper (single `News` group) — the contract shape is unchanged (plan: Versioning = MINOR).
- **ponytail**: `categories[]` with one group is vestigial. Upgrade path: flatten to `articles[]` in a future MAJOR API cleanup, not worth a breaking change now.

### D12 — Unavailable state on the filter chip (clarify Q5)
- **Decision**: `FeedSourceFilterBar` renders unavailable sources with an inline decorative SVG (`aria-hidden`) + visible text "unavailable" after the name, muted but ≥ 4.5:1; still a `<button aria-pressed>`. `FeedSourceStatusBanner.tsx` and its test cases are deleted.
- **Alternatives**: new icon file under `ui/icons` (one use → inline).

### D13 — Observability
- **Decision**: one structured line per source refresh from the application layer: `logger.info({ route: 'feeds:images', outcome: 'feed_images_resolved', meta: { sourceId, articles, fromFeed, fromPage, placeholders, lookups, lookupTimeouts, logoDiscarded } })`. `feed_images_resolved` is added to the `LogOutcome` union in `config/logger.ts`. Blocked (SSRF) hops log `warn` with `outcome: 'validation_error'`, `meta: { sourceId, host }` (no full URL).
- **Rationale**: lets SC-001 be measured from production logs (Principle V).

### D14 — UI structure (apple-design / emil-design-eng consulted)
See plan.md "UI decisions". Sticky filter bar stays opaque (`bg-white dark:bg-surface`): a translucent bar would need new reduced-transparency fallbacks, since `global.css` only has them for overlays. Motion is limited to the existing press feedback; the filter-change fade was dropped (FR-017 limits motion, it does not require it). On phones the chip bar is one row that scrolls inside itself.

## Sources

- [Feedly: title-only and card views](https://devhd.wordpress.com/2013/11/14/the-new-title-only-and-card-views/)
- [Inoreader vs Feedly feature comparison](https://www.inoreader.com/alternative-to-feedly)
- [Inoreader Magazine view](https://www.inoreader.com/blog/2015/04/presenting-magazine-view-clear-all.html)
- [Reeder help (timeline position, no unread counts)](https://reederapp.com/help/)
- [Reeder unified timeline launch](https://alternativeto.net/news/2024/9/reeder-launches-new-major-version-with-unified-rss-video-podcasts-and-social-feeds)
- [NetNewsWire smart feeds](https://netnewswire.com/help/mac/5.1/en/smart-feeds.html)
- [Feedly vs Readwise Reader](https://www.readless.app/blog/feedly-vs-readwise-reader-2026)
- [Techmeme River](https://news.techmeme.com/061211/river)
- [Google News clusters](https://searchengineland.com/google-news-adds-expandable-clusters-story-labels-more-to-home-page-77373)
- [Google Full Coverage](https://blog.google/products/news/get-full-news-story-full-coverage-search/)
- [Flipboard layout engine](https://about.flipboard.com/engineering/layout-in-flipboard-for-web-and-windows/)
