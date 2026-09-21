# Research: Header Search Redesign — Instant Suggestions (069)

**Date**: 2026-09-21 · **Phase**: 0 (plan) · **Spec**: [spec.md](./spec.md)

Each decision: **Decision / Rationale / Alternatives rejected**. Code references are the files read while planning. Design skills consulted: `apple-design` (Principle XI); its conclusions are folded into D11–D14. `emil-design-eng` and `animate` were not invoked separately: the feature introduces **no new motion vocabulary** (D13) and reuses tokens whose values were already decided in spec 059.

`ponytail:ponytail-debt` was run over the touched area: the existing `ponytail:` markers in the repo are in `library`, `feeds` and `queries/libraryQueries.ts`. **None is in `discogsCatalog`, `HeaderSearchBox` or `motion/`** — there is no recorded ceiling to pay down here, and none of the shortcuts this plan takes builds on top of one.

## 1. Current state (verified by reading the code)

| Area | File | Today |
|---|---|---|
| Header field | `frontend/src/components/HeaderSearchBox.tsx` | `role="search"` form, `w-28 sm:w-64 md:w-80`, `Input` + icon `Button`. Submit → `buildSearchPath(query, 1, onResultsPage ? activeFilters : undefined)`, `replace` on the results page. No expansion, no backdrop, no suggestions. |
| Header shell | `frontend/src/components/AppHeader.tsx` | `sticky top-0 z-40 grid grid-cols-[1fr_auto_1fr] h-(--header-h)`. The search is the middle `auto` cell. |
| URL/filters | `frontend/src/hooks/useSearchQueryParams.ts` | `useSearchQueryParams()` + `buildSearchPath(query, page, filters)`. Already the submit contract — unchanged by this feature. |
| Destinations | `frontend/src/components/SearchResultCard.tsx` L89–90 | `master` → `/app/masters/:id`, otherwise `/app/releases/:id`. The app has **no** artist screen (`App.tsx` routes). |
| Catalog search (client) | `frontend/src/services/discogsApi.ts`, `queries/discogsQueries.ts` | `search()` via `authorizedFetch`; `useCatalogSearchInfinite` keyed by `(type, query, perPage, filters)`. |
| Catalog search (server) | `backend/src/adapters/discogsCatalog/discogsRoutes.ts` | `GET /api/discogs/search` → `resolveCatalogCredential` → `searchCatalogWithRatings` → master-first reorder → JSON. `standardRateLimit` (100/min) shared by all four routes in the file. |
| Rating fan-out | `backend/src/application/discogsCatalog/searchCatalogWithRatings.ts` | Every `release`/`master` hit is enriched with its community rating: a master costs `getMasterRelease` **plus** `getReleaseRating` (2 upstream calls), a release costs 1 — `mapWithConcurrency(…, 5, …)`. Cache key `discogs:search:{type}:{q}:{page}:{perPage}:{genre}:{style}:{format}`, TTL 30 min, **credential not in the key** (shared across users). |
| Raw search | `backend/src/adapters/discogsCatalog/discogsCatalogAdapter.ts` L362–422 | `resultType === 'release'` → no `type` param upstream, then the raw response is filtered to `release`/`master` — **`artist` hits arrive and are discarded**. `mapSearchResult`'s zod enum is `['release','artist','master']`, so an unfiltered `label` hit would throw `DiscogsValidationError`. |
| Cache | `backend/src/ports/cache/cachePort.ts`, `adapters/cache/cacheAdapter.ts` | `withCache(key, ttl, fetcher)` — cache-aside, **coalesces concurrent identical keys**, fail-soft (no Redis → straight to the fetcher). |
| Motion layer | `frontend/src/motion/` | `spring.sheet` = `{ duration: 0.35, bounce: 0 }`; `motionDuration.fade` = 200 ms; `useScrollLock` (ref-counted, gutter-compensated), `useRestoreFocus`, `usePrefersReducedMotion`, `useEscapeKey`. `Overlay` bundles scrim + **`useFocusTrap` + `aria-modal`** — modal by construction. `motionFeatures.ts` loads `domMax` but its doc comment says components "must still not adopt `layout`/`layoutId` casually". |
| Scrim material | `frontend/src/styles/global.css` | `.overlay-scrim` with `@supports not (backdrop-filter)`, `prefers-reduced-transparency` and `prefers-contrast: more` fallbacks already written. |
| Combobox | — | **None exists.** No `role="combobox"`, no `aria-activedescendant` anywhere in `frontend/src`. This is the first. |
| Announcements | `frontend/src/pages/LibraryListPage.tsx` L241 | `<p role="status" className="sr-only">` — the repo's polite-announcement pattern. |
| e2e | `e2e/tests/`, `e2e/helpers/` | `@axe-core/playwright` via `helpers/axe.ts`; `helpers/focusRing.ts`, `helpers/motion.ts` (`expectNoTransformMotion`), `helpers/contrast.ts`, `helpers/theme.ts`. |

## 2. Decisions

### Backend

**D1 — A new route `GET /api/discogs/suggest`, not a narrow shape of `/api/discogs/search`.**
Decision: add one handler to the **existing** `backend/src/adapters/discogsCatalog/discogsRoutes.ts`. Contract: [contracts/suggest-api.md](./contracts/suggest-api.md).
Rationale: `searchCatalogWithRatings` enriches unconditionally — a 5-hit page costs up to 10 extra Discogs calls, which is disqualifying for a panel that fires while the collector types (Principle II, SC-011, SC-003). The two surfaces also differ in every other axis: no pagination, no filters, a hard cap of 5, a different cache TTL and a different rate-limit bucket. A `?ratings=0&suggest=1` flag on `/search` would fork the existing use case down the middle and put the suggestion-shaping rule on the full results screen's hot path.
Alternatives rejected: a `ratings=0` query flag on `/search` (two behaviours behind one contract, and the 2+3 rule still needs somewhere to live); a second use case reading the same route (the route would then choose between two use cases — orchestration in an adapter, Principle VIII); a whole new `adapters/search/` folder (one handler does not need a router of its own).

**D2 — One new `resultType: 'any'` on the existing port, so one upstream request yields artists *and* albums.**
Decision: widen `SearchCatalogOptions.resultType` to `'release' | 'artist' | 'any'`. In `discogsCatalogAdapter.searchCatalog`, `'any'` sends **no** `type` param upstream (same as `'release'` today) and keeps the raw hit types `release | master | artist`, dropping everything else. `'release'` and `'artist'` behave exactly as today.
Rationale: rung 2 of the ladder — the artist hits needed for the 2-artist allowance are already in the response the adapter receives and throws away (L409–419). This is SC-011 ("at most one request to the external catalogue") for free. The existing defensive filter must stay per-mode, otherwise `/api/discogs/search?type=release` would start returning artists; and it must not be removed, otherwise a `label` hit crashes `mapSearchResult`.
Alternatives rejected: two upstream calls (`type=artist` + `type=release`) — violates SC-011 and doubles the Discogs cost per keystroke pause; a second port method `searchCatalogAnyType` (an interface grows a method for a one-line difference, Principle IV); calling Discogs directly from the new use case (Principle VIII).

**D3 — Upstream page size 20.**
Decision: the use case requests `perPage: 20`, `page: 1`.
Rationale: Discogs orders by relevance and interleaves types, so a 5-hit page frequently contains zero artists; 20 makes "2 artists + 3 albums, cross-filled" resolvable from one response in practice, at no extra request cost. It is one number in one place.
Alternatives rejected: 5 (cannot satisfy the quota from one request); 50 (the `/search` default — a bigger payload and a bigger JSON parse for a 5-row panel).

**D4 — The 2+3-with-cross-fill rule is a pure domain function, and it lives on the backend.**
Decision: `backend/src/domain/discogsCatalog/suggestionQuota.ts` exports `allocateSuggestions(hits): CatalogSuggestion[]`. Table and ordering: [data-model.md §3](./data-model.md).
Rationale (domain, not application): it is a business rule with its own truth table and no infrastructure — exactly the shape of the existing `domain/library/librarySort.ts` / `libraryFilters.ts`, and it earns a unit table of its own (Principle I). Rationale (backend, not frontend): the single upstream request, its cache and its rate limit all already live on the backend; shaping there keeps the wire payload at 5 rows instead of 20 raw hits on a mobile connection (SC-003), keeps one implementation of the rule, and keeps the raw Discogs shape from leaking to the browser.
Alternatives rejected: a private function inside the use case (saves one 20-line file but hides the rule from the domain layer where the repo's precedent puts it); the frontend doing the shaping (two sources of truth once anything else consumes the endpoint, a larger payload, and the rule would be untestable without a React harness).

**D5 — Cache key `discogs:suggest:{normalizedQuery}`, TTL 5 minutes, shared across users.**
Decision: `normalizedQuery` = `trim()` → collapse internal whitespace → `toLowerCase()`. The **shaped** 5-row payload is cached (not the 20 raw hits) through the existing `cacheAdapter.withCache`.
Rationale: FR-017 — a repeated query inside the window costs zero upstream requests, and `withCache`'s coalescing additionally collapses concurrent identical lookups (two tabs, or a Retry landing on an in-flight key). The `discogs:suggest:` prefix cannot collide with `discogs:search:`, so the existing 30-minute search cache is untouched. 5 min rather than 30: the key space here is every 2+-character prefix a collector types, which is far larger than the results-screen key space, and a suggestion panel that is half an hour stale is worse than one that is five minutes stale. Normalising the query collapses `"Iron "`, `"iron"` and `"IRON"` onto one entry, which is where most of the hit rate comes from. **No credential in the key, deliberately**: `/database/search` returns the same public catalog rows whichever token signs it — only rate-limit accounting differs — and this matches the existing `discogs:search:*` key. The response therefore carries **no echo of the query** (a shared entry would echo whichever spelling wrote it); the client already knows what it asked, and out-of-order handling is keyed client-side (D8).
Alternatives rejected: caching the 20 raw hits and shaping per request (bigger entries, no benefit — the shaping is deterministic); 30 min to match `/search` (stale panels, and a much larger key space); adding the credential to the key (multiplies the key space by the user count for identical data, and would regress the existing behaviour by precedent); a client-only cache (a second collector typing the same query still pays a Discogs request).

**D6 — Its own rate-limit bucket at the standard threshold.**
Decision: a second `rateLimit({ … limit: RATE_LIMIT_THRESHOLDS.standard … })` instance declared locally in `discogsRoutes.ts`, applied only to `/suggest`. No new constant and no new tier in `rateLimitOptions.ts`.
Rationale: `/suggest` is an order of magnitude chattier than the other three routes; sharing `standardRateLimit` means typing in the header can exhaust the budget for the release/master detail requests on the same page (and vice versa). A separate bucket at the same number costs four lines and isolates the two failure modes. Declaring the `rateLimit(...)` call locally is required by the CodeQL note in `rateLimitOptions.ts`. 100/min ≈ 33 pauses-in-typing per minute at SC-004's ≤3 lookups per 10-character query — comfortably above a human.
Alternatives rejected: sharing `standardRateLimit` (cross-starvation); a new `suggest` tier constant (a third number nobody has a reason to tune differently yet — add one when a threshold actually needs to diverge).

**D7 — Observability.**
Decision: one `logger.info({ route: '/api/discogs/suggest', outcome: 'success', uid, meta: { queryLength, artists, albums, returned } })` on the happy path; the failure branches reuse the route file's existing `auth_failed` / `unavailable` / `error` shapes verbatim.
Rationale: Principle V — `queryLength` + the three counts answer "why was the panel short / empty" without a debugger. The **query text is deliberately not logged**, matching `/api/discogs/search`, which logs counts and filter names but never `q`. A cache-hit flag is not logged: `CachePort.withCache` cannot report it, and widening a port for one log field is not worth it.

### Frontend — data & state

**D8 — TanStack Query per query string; no request cancellation, no manual request bookkeeping.**
Decision: `discogsKeys.suggest(query)` + `useCatalogSuggestions(query)` in the **existing** `frontend/src/queries/discogsQueries.ts`, with `enabled: query.length >= 2 && hasEdited`, `staleTime: 5 * 60_000` (mirrors D5), `retry: false`.
Rationale: FR-013/SC-005 (a superseded response must never render) is structural, not code: a late response lands in *its own* cache entry, and the component only ever reads the entry for the text currently in the field — there is nothing to discard. `staleTime` makes FR-017 hold client-side too (retyping within 5 minutes is zero network). `retry: false` surfaces the error state immediately so Retry (`refetch()`) is the collector's, not a hidden loop's (FR-019); it matches `useCatalogRelease`'s existing convention.
Alternatives rejected: `AbortController` per keystroke (FR-013 is already satisfied; aborting also throws away a response that the cache would have served on the next keystroke); a request-id/sequence guard (hand-rolling what the query key already gives); a new `useSearchSuggestions.ts` hook file (the query belongs with the other catalog queries, and the component-local part is the debounce).

**D9 — The 300 ms debounce is eight lines inside `HeaderSearchBox`, not a hook file and not a dependency.**
Decision: `useState` + `useEffect` + `setTimeout` + cleanup over the field value; the debounced value feeds `useCatalogSuggestions`. A paste is a single `change` event, so it is one lookup by construction (spec edge case).
Rationale: rung 6. There is exactly one consumer; `frontend/src/hooks/` has no debounce helper and inventing a shared one for a single caller is the abstraction Principle III forbids.
Alternatives rejected: a `useDebouncedValue` hook file (one caller); `lodash.debounce`/`use-debounce` (a dependency for eight lines).

**D10 — `hasEdited` gates the panel, satisfying clarification 4 without a second state machine.**
Decision: one boolean, set on the first `onChange` after activation and cleared on collapse. `enabled` requires it, so activating on the results screen with a pre-filled query fires **no** lookup and shows **no** panel until the collector edits. On activation the field's text is selected (`select()` after `focus()`).
Rationale: FR-004 verbatim. It is one flag next to the value it guards.
Alternatives rejected: comparing the current value against the pre-fill (breaks when the collector types the same string back); a separate `panelMode` enum (a state machine for one boolean).

### Frontend — structure, a11y, motion (`apple-design` consulted, Principle XI)

**D11 — The ARIA pattern: WAI-ARIA 1.2 combobox with `aria-activedescendant`, never moving DOM focus.**
Decision: full contract in [contracts/header-search-ui.md §3–§6](./contracts/header-search-ui.md). The input keeps `type="search"` and gains `role="combobox"`, `aria-expanded`, `aria-controls="header-search-listbox"`, `aria-autocomplete="list"` and `aria-activedescendant`; the panel always renders `<ul role="listbox" id="header-search-listbox">` while open; arrows move `aria-activedescendant` only.
Rationale: this is the first combobox in `frontend/src`, so the pattern is being set here — take the standard one rather than invent. Keeping DOM focus in the input is what makes clarification 3 work: nothing is ever focused inside a popup, so there is nothing to trap, and FR-007 ("focus leaves the search → collapse") stays a single containment check. `role="combobox"` is permitted on `input type="search"` in ARIA 1.2, so no native affordance is given up and no Clear button is invented (nothing in the spec asks for one).
Alternatives rejected: `role="dialog"` for the phone overlay (contradicts clarification 3 and FR-024 explicitly); roving DOM focus into the options (would make Tab-out/refocus behaviour fight FR-007 and break "type without a second action"); `aria-owns` with a detached popup (unnecessary — the listbox is a DOM sibling); a `<datalist>` (no control over rendering, no artist/album labelling, no empty/error states).

**D12 — Reuse `useScrollLock`, `useRestoreFocus`, `useEscapeKey` and `.overlay-scrim`; do **not** reuse `Overlay` / `Sheet` / `useFocusTrap`.**
Decision: the backdrop is a plain `<div aria-hidden="true">` carrying the existing `.overlay-scrim` class plus `backdrop-blur-xl`, rendered at `z-30` (under the header's `z-40`). `useScrollLock(expanded && isPhoneWidth)` implements FR-005's "scrolling behind is suspended". `useRestoreFocus` implements FR-007's focus return. `useEscapeKey` is already the repo's Escape hook.
Rationale: `Overlay` bundles a focus trap and `aria-modal="true"` — exactly the two things clarification 3 rules out — and its scrim is the same material this needs, so taking the three hooks and the CSS class gives the whole benefit with none of the modality. `.overlay-scrim` already carries the `@supports not (backdrop-filter)`, `prefers-reduced-transparency` and `prefers-contrast: more` fallbacks, so **no new custom CSS is written** (Constitution "No custom CSS without justification"). `backdrop-blur-xl` is 24 px — on Tailwind's scale, so no arbitrary value, and within FR-002's "≈20 px".
Alternatives rejected: a `nonModal` prop on `Overlay` (a second mode through a component whose entire contract is modality — and it would have to reach into `useFocusTrap`, `aria-modal` and the `Card` surface); a new `.search-scrim` class (duplicating three media-query fallbacks that already exist).

**D13 — Motion: `spring.sheet` for the expansion, `motionDuration.fade` for backdrop and panel. No new token, no new animation.**
Decision: the form's width animates on `spring.sheet` (`0.35 s`, `bounce: 0`) — FR-002's "~0.35 s, no overshoot" is that token's exact definition. Backdrop and panel cross-fade over `motionDuration.fade` (200 ms). The panel never animates size or position (FR-014/SC-008). Reduced motion: `MotionConfig reducedMotion="user"` already neutralises the `m` transform globally; `usePrefersReducedMotion` additionally drops the fade so the change is instant (FR-009), with the backdrop, focus and announcements unchanged.
Rationale: `apple-design` §4 — critically damped, no overshoot, because no gesture with momentum precedes the expansion; §7 — the same path in and out, so collapse mirrors expand; §14 — reduced motion means a gentler equivalent, not no feedback (the backdrop still appears). The spec's Assumptions already state that the settle timing matches the app's existing motion settings, so introducing a token here would contradict the spec.
Alternatives rejected: `layout` / `layoutId` (`motionFeatures.ts` explicitly warns components off them, and `ViewModeToggle` set the precedent of a measured transform instead); a bespoke spring for the header (a fourth spring whose numbers equal an existing one); animating the panel's height on load (guarantees the resize FR-014 exists to prevent).
`ponytail:` animating `width` runs layout on the header row each frame. It is one small element inside a fixed-height (`h-(--header-h)`) header, so the page below never reflows, and `motion-performance.spec.ts`'s existing pattern is the check. Ceiling: a measurable frame drop on the header. Upgrade path: `ViewModeToggle`'s measured-transform approach (animate a `scaleX`ed track with counter-scaled content) instead of `width`.

**D14 — Two purpose-built layouts, split at Tailwind's `sm:` (640 px) — exactly FR-005/FR-006's boundary.**
Decision: below 640 px the collapsed entry point is a 44×44 icon button and activation mounts a full-width overlay pinned under the header; from 640 px up the field is visible and expands in place to `sm:w-96`. The 640–1023 px band follows the wide layout (spec Assumptions). Layout table: [contracts/header-search-ui.md §2](./contracts/header-search-ui.md).
Rationale: `sm:` is 640 px, so the spec's two thresholds are already breakpoint utilities — no media-query JS and no device detection (Constitution "Dual responsive layout"). A cramped 7 rem field at phone width is the complaint US1 opens with; an icon button that is a real 44×44 target is the fix, and it keeps the header's three-column grid intact.
Alternatives rejected: one field that merely reflows (the constitution requires two purpose-built layouts, and it is what makes the field cramped today); a third layout for 640–1023 px (a state nobody asked for — spec Assumptions).

**D15 — One new frontend component file, `HeaderSuggestionPanel.tsx`.**
Decision: the panel (listbox, the five states, the skeleton rows, the Retry button) is its own component; `HeaderSearchBox` keeps activation, the field, keyboard handling, the announcement region and the backdrop.
Rationale: without the split `HeaderSearchBox` owns two unrelated reasons to change (Principle IV), and the panel's five visual states are the part that wants its own RTL test file. It is one file, not a folder.
Alternatives rejected: everything in `HeaderSearchBox` (one file, ~400 lines, two test suites fighting over one render tree); a `components/headerSearch/` folder with five files (scaffolding for one panel).

**D16 — The panel surface is the existing `<Card>`; suggestion rows are plain `<li>`, not `SearchResultCard`.**
Decision: `Card` for the floating surface (the precedent `motion/Overlay.tsx` sets); each row renders its own thumbnail + primary label + secondary detail + a text kind label.
Rationale: `SearchResultCard` is a `<Link>`-wrapped result card with actions, ratings and a detail layout — it cannot be an `<li role="option">` in a listbox and would drag the whole results-card contract into the header. The card *surface* pattern, which is what the constitution says must not be hand-repeated, is reused through `Card`.
Alternatives rejected: reusing `SearchResultCard` (wrong role, wrong size, wrong dependencies); a new `ui/Popover` primitive (one caller).

**D17 — Destinations are derived from `resultType`, and the response carries no redundant `kind` field.**
Decision: `master` → `/app/masters/:id`, `release` → `/app/releases/:id`, `artist` → `buildSearchPath(title)`. The frontend derives the visible "Artist"/"Album" label from the same field.
Rationale: FR-012; `resultType` already carries the distinction and `SearchResultCard` already branches on it for the same two paths, so adding a `kind` field would create a second source of truth for one ternary. `buildSearchPath` is the existing submit contract, so an artist suggestion lands on the results screen the same way a submission does.
Alternatives rejected: a `kind: 'artist' | 'album'` field on the wire (redundant with `resultType`); a `destination` URL string from the backend (the backend would own frontend routing).

**D18 — Glossary fixed in [data-model.md §1](./data-model.md).**
Decision: **release** = one Discogs edition (`/app/releases/:id`); **master** = Discogs' grouping of editions (`/app/masters/:id`); **album** = the collector-facing word for either, used in all UI copy and in the 2+3 rule; **artist** = a Discogs artist hit, which opens results because the app has no artist screen.
Rationale: the spec, the ticket and the code use "album" and "release" interchangeably, which is exactly what left this Outstanding after clarify. One table ends it, and it is the vocabulary both the quota rule and the UI copy are written against.

## 3. Cut from this plan (and when to bring it back)

| Cut | Why | Add when |
|---|---|---|
| Request cancellation (`AbortController`) | D8 — the query key already makes stale responses unrenderable | never, unless upstream cost per abandoned keystroke becomes measurable |
| A shared `useDebouncedValue` hook | D9 — one caller | a second caller appears |
| A `kind` field on the wire | D17 — derivable from `resultType` | the two ever stop being equivalent |
| A `nonModal` prop on `Overlay` | D12 — modality is that component's whole contract | a second non-modal overlay appears |
| A `suggest` rate-limit tier constant | D6 — no reason yet to differ from `standard` | the two thresholds need to diverge |
| Credential in the suggest cache key | D5 — identical public catalog data per credential | Discogs starts personalising `/database/search` results |
| Logging the query text | D7 — matches `/search`'s existing discipline | a support case actually needs it |
