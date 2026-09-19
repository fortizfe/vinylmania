# Research: Library Redesign — Sort, Infinite Scroll, A11y (068)

**Date**: 2026-09-19 · **Phase**: plan · **Spec**: [spec.md](./spec.md)

Each decision: **Decision / Rationale / Alternatives rejected** (one line each). Code references are the files read while planning. Design skills consulted: `apple-design`, `emil-design-eng`, `animate` (Principle XI); their conclusions are folded into D13–D20.

## 1. Current state (verified)

| Area | File | Today |
|---|---|---|
| List use case | `backend/src/application/library/listLibraryEntries.ts` | Two paths: no filters → `repository.listEntries` (Firestore `orderBy addedAt desc` + `offset/limit` + `count()`); filters → `listAllEntries` + `matchesLibraryFilters` + slice. |
| Sync | `backend/src/application/library/syncLibrary.ts` | `collectionFacets()` persists `year/label/primaryArtist/genre/style` from `basic_information` on every non-skipped sync. `CollectionInstance.title` is already mapped (`''` when missing) but not persisted. |
| Route | `backend/src/adapters/library/libraryRoutes.ts` | `GET /api/library?page&pageSize&refresh&genre&style&format`; unknown filter values are passed through (never a 400). |
| Frontend list | `frontend/src/pages/LibraryListPage.tsx` | `useQuery` per page, Previous/Next buttons, `?page=` in URL, `FiltersControl` (collapsible, draft → Apply). |
| Infinite reference | `frontend/src/pages/SearchResultsPage.tsx`, `queries/discogsQueries.ts` | `useInfiniteQuery` keyed without `page`; `IntersectionObserver` sentinel **without** `rootMargin`; next-page error → `role="alert"` + Retry; `state={{ from }}` on result links. |
| Filters | `components/FiltersControl.tsx`, `filters/SelectableListFilter.tsx` | Each facet = trigger button → centred `Modal` with checkboxes. |
| Overlays | `motion/Overlay.tsx`, `motion/Sheet.tsx`, `components/ui/Modal.tsx` | Variants `center` / `end` only; `Sheet` supports `dismissAxis: 'y'` logic but no bottom placement. Overlays are **not portalled**. |
| Back nav | `pages/RecordDetailPage.tsx` | Back link + post-delete `navigate` hard-code `/app/library` (5 places). `ReleaseDetailPage`/`MasterReleaseDetailPage` already read `location.state.from`. |

## 2. Decisions

### Backend

**D1 — Sort comparator.**
Decision: pure `sortLibraryEntries(entries, sort)` in `backend/src/domain/library/librarySort.ts` (sibling of `libraryFilters.ts`), using one module-level `new Intl.Collator('en', { sensitivity: 'base', numeric: true })` and a key normaliser that trims and strips one leading article matching `/^(the|a|an|el|la|los|las|die|les)\s+(?=\S)/i`. Keys are computed once per entry (decorate–sort–undecorate).
Rationale: stdlib (rung 3) covers case/diacritics (FR-003); a fixed `'en'` locale keeps the order identical on every server; `numeric` gives "2 Unlimited" < "10cc" as a person expects. The lookahead leaves a name that is only an article ("The") intact (spec edge case).
Alternatives rejected: `localeCompare` per comparison (re-creates a collator each call, slower); `String.normalize('NFD')` + strip marks (reinvents collation, wrong for ß/ø); Firestore `orderBy` (cannot ignore case/accents/articles).

**D2 — Tie-break chain and missing fields.** See [data-model.md §3](./data-model.md). Decision: records whose sort key is empty/absent form a trailing group ordered by `addedAt desc, id asc` for every direction; every chain ends with `id asc`.
Rationale: FR-004/FR-005; `id` is the only guaranteed-unique field (bulk imports share `date_added`).
Alternatives rejected: `Array.prototype.sort` stability alone (stable only relative to the input order, which is not a contract).

**D3 — Single list path; `repository.listEntries` deleted.**
Decision: `listLibraryEntries` always does `listAllEntries → filter → sort → slice`. `listEntries` is removed from `LibraryRepositoryPort`, `firestoreLibraryRepository`, and the 5 test doubles that stub it; `PaginatedLibraryEntries` (domain) is removed if nothing else uses it.
Rationale: clarify Q1; one path = one test matrix and a global order for every batch (FR-002).
Alternatives rejected: keep the Firestore fast path for the default order (two behaviours to keep consistent, tie-breaks differ).
`ponytail:` every batch request reads the whole per-user mirror (≈ N reads). Scrolling a 300-record collection = 15 × 300 = 4 500 reads vs ≈ 2 400 today (offset reads bill skipped docs). Ceiling: a few thousand records or read-quota pressure. Upgrade path: cache the sorted id list per `(uid, sort, filters)` in Redis for the sync-marker TTL, or persist normalised sort keys and page with Firestore cursors.

**D4 — Album title persistence.**
Decision: `collectionFacets()` adds `title` when `instance.title.trim() !== ''`; `persistCollectionFacets` and `toLibraryEntry` gain `title`; `LibraryEntry.title?: string`.
Rationale: same source and same write as `primaryArtist` (feature 061) — zero extra Discogs requests (Principle II) and no extra Firestore writes (the facet write already happens every sync). Backfill = next sync; unsynced records follow the missing-last rule.
Alternatives rejected: read `release.title` from enrichment (only available for the 20 enriched items, not the full mirror); a one-off migration script (the sync already is the backfill).

**D5 — `createLibraryEntry` does NOT persist artist/title.**
Decision: unchanged.
Rationale: YAGNI; the spec accepts "last until next sync" (edge case) and the sync marker expires in ≤ 5 min.
Alternatives rejected: persisting from the created release (adds a second writer for the same facets, with its own tests). Add it if users report newly added records "missing" under artist sort.

**D6 — Query-param contract and parsing.**
Decision: `sort ∈ {added, artist, album}`, `dir ∈ {asc, desc}`; parsed by a `parseLibrarySort(req)` in `libraryRoutes.ts` next to `parseLibraryFilters`. Invalid/missing → silent default (`added`; `dir` defaults to `desc` for `added`, `asc` otherwise). Never a 400. Contract: [contracts/library-list-api.md](./contracts/library-list-api.md).
Rationale: matches how filters are handled today; mirrors FR-007 on the client.
Alternatives rejected: zod schema with 400 (inconsistent with filter params; the frontend already normalises).

**D7 — Observability.**
Decision: the existing `/api/library` success log gains `meta: { filters, sort, dir, page, totalItems }`.
Rationale: Principle V; answers "why is my list in this order / empty" from logs. No new log line.

### Frontend — data & state

**D8 — Infinite query.**
Decision: `useLibraryList(sort, filters)` becomes `useInfiniteQuery` keyed `libraryKeys.list(sort, filters)` (no page), `initialPageParam: 1`, `getNextPageParam: (last) => last.page * last.pageSize < last.totalItems ? last.page + 1 : undefined`, `retry: false` (kept). Page size constant 20.
Rationale: copy of `useCatalogSearchInfinite` (rung 2). Per-key caching also satisfies FR-015 (a late response for an old key never renders under the new key) — no cancellation code.

**D9 — Sentinel with 300 px `rootMargin`; tall screens.**
Decision: a local `IntersectionObserver` effect in `LibraryListPage` with `rootMargin: '0px 0px 300px 0px'`, re-created when `hasNextPage/isFetchingNextPage/nextPageError` change (same deps as Search).
Rationale: re-creating the observer after each fetch fires an initial intersection callback, so a sentinel still inside the margin auto-loads the next batch → tall screens fill themselves (spec edge case) with no extra code.
Alternatives rejected: extracting a shared hook and migrating Search (touches Search, whose behaviour must not change). `ponytail:` two copies of a ~12-line effect; extract when a third infinite list appears.

**D10 — Refresh.**
Decision: `useRefreshLibrary(sort, filters)` fetches page 1 with `refresh=true`, then `setQueryData(key, { pages: [data], pageParams: [1] })`.
Rationale: FR-014 — resets to the first batch in one write; the rest reloads on scroll.

**D11 — Invalidation after mutations.**
Decision: unchanged (`invalidateQueries(libraryKeys.all)`).
Rationale: mutations run from the detail page, where the list is inactive. On return TanStack refetches each loaded page in sequence, which keeps the scroll position valid.
`ponytail:` cost = one request per loaded page. Ceiling: very deep scrolls followed by edits. Upgrade: `resetQueries({ queryKey: libraryKeys.lists() })` (drops to page 1, loses position).

**D12 — URL state and back navigation.**
Decision: `useLibraryQueryParams` drops `page` and returns `{ sort, genre, style, format }`. US1 changes the signature to `buildLibraryPath(filters?, sort?, page = 1)` while Previous/Next still exist; US2 removes the `page` parameter, leaving the final `buildLibraryPath(filters?, sort?)`. It omits the defaults (`added`/`desc`); for a non-default sort it writes **both** `sort` and `dir`. A legacy `?page=` is ignored. `LibraryListPage` computes `currentLibraryPath` and passes it to `RecordCard`/`RecordListRow` as a **required** `from` prop (`<Link state={{ from }}>`, the `SearchResultCard` pattern). Both components are used only by `LibraryListPage` (`WishlistPage` imports only `RecordCardSkeleton`), so there's no optional branch. `RecordDetailPage` reads `(location.state as { from?: string } | null)?.from ?? '/app/library'` for every Back link, `backTo`, and the post-delete `navigate` (the `ReleaseDetailPage` pattern).
Alternatives rejected: `navigate(-1)` (breaks deep links); session storage (a second source of truth).

**D13 — Live filters on Library only.**
Decision: `FiltersControl` gains one prop, `live?: boolean`. When `live`:
- it renders the three facets without `CollapsibleFilterPanel` and without the `<form>`/Apply (the sheet/drawer is the container);
- each facet change calls `onApply(next)` immediately (no draft state is committed separately);
- each `SelectableListFilter` gets `inline`, rendering a native `<details><summary>` disclosure with the same search box + `Checkbox` list instead of trigger + nested `Modal`;
- a text `Button` "Clear all filters" is always rendered, with `aria-disabled="true"` and a no-op when nothing is active (it stays focusable, so focus is never dropped when the last filter clears).

Search passes nothing → byte-for-byte unchanged behaviour.
Rationale: one filter component stays shared (feature 038's FR-001). Inline lists are required because overlays are not portalled: a nested `fixed` Modal inside a transformed sheet/drawer surface is positioned relative to that surface, and two stacked `Overlay`s both react to one Escape (`useEscapeKey` has no stack). `<details>` = native disclosure with built-in expanded state (rung 4). It is a documented exception to the canonical animated `disclosure` pattern in `frontend/src/motion/README.md`: instant, no height animation, so nothing to reduce. This is recorded in the README by the US3 docs task.
Alternatives rejected: portal `Overlay` and add an overlay stack for Escape/focus traps (new infrastructure for one screen); a Library-only filter component (duplicates options/state logic).

**D14 — Sort controls.**
Decision:
- `≥ 640 px`: native `<select id="library-sort">` with a visible `<label>` "Sort". It has three `<optgroup label="Date added|Artist|Album">` × two options each; `onChange` navigates immediately.
- Sheet: a `<fieldset><legend>Sort by</legend>` containing three nested `<fieldset>`s (legend per criterion). Each holds two native `<input type="radio" name="library-sort">` rows, `min-h-11`, full-row label.

The six options (value, label, group, announcement) live in `frontend/src/constants/librarySortOptions.ts`, the only new constants file.
Rationale: clarify Q4; native controls give name/role/value/keyboard for free (rung 4); one radio `name` = arrow-key roving across groups natively. Styling for the select: `min-h-11 rounded-lg border border-stone-500 bg-white px-3 text-sm text-stone-900 dark:border-border-dark dark:bg-surface-raised dark:text-stone-100 dark:[color-scheme:dark]` (the last one makes the OS popup dark).
Alternatives rejected: a custom listbox/menu (focus management, ARIA and tests for no gain).

### Frontend — layout, material & motion

**D15 — Component structure (one new component file, one bar element).**
Decision: `frontend/src/components/LibraryToolbar.tsx` renders **one** bar element that is the floating capsule below 640 px and the sticky toolbar from 640 px up. Only Tailwind breakpoint classes switch it (D18), so `ViewModeToggle` is mounted **once**. Inside the bar:
- `ViewModeToggle` (once);
- a "Sort & Filter" button with `sm:hidden`;
- the "Sort" label + `<select>` wrapper with `hidden sm:flex`;
- a "Filters" button with `hidden sm:inline-flex`;
- one `Modal` whose `position` is `bottom` (below 640 px, title "Sort & Filter") or `end` (≥ 640 px, title "Filters").

The two panel triggers have different names, so there are no duplicate ids or testids.
Alternatives rejected: two CSS-hidden bars, each with its own `ViewModeToggle`. That duplicates `data-testid="view-mode-toggle|-grid|-list|-pill"` and breaks RTL `getByTestId` (`libraryListFlow.test.tsx`) and Playwright strict mode (`view-mode-toggle.spec.ts`).

The panel body is internal: sort radios (mobile only) + `<FiltersControl live>`. A `matchMedia('(min-width: 640px)')` change listener closes an open panel when the breakpoint is crossed (spec edge case). Header (title, count, Refresh) stays in `LibraryListPage`.
Rationale: one file owns both layouts (Constitution "Dual responsive layout" via Tailwind breakpoints, no device detection).

**D16 — Bottom sheet = new `bottom` variant on the existing overlay stack.**
Decision:
- `Overlay`: `variant: 'center' | 'end' | 'bottom'`. `bottom` uses scrim `items-end justify-center` and surface `max-h-[85dvh] w-full overflow-y-auto`, with motion `y: '100%' → 0 → '100%'` on `spring.sheet`.
- `Sheet`: picks `variant = dismissAxis === 'y' ? 'bottom' : 'end'`; its handle already renders at the top for `y`; fling exit stays `spring.momentum`.
- `Modal`: `position?: 'center' | 'end' | 'bottom'`. `bottom` → `<Sheet dismissAxis="y" showHandle surfaceClassName="rounded-b-none pb-[env(safe-area-inset-bottom)]">`.

Single detent (content height, capped at 85 dvh).
Rationale: reuses focus trap, focus restore, scroll lock, Escape, scrim click, drag-to-dismiss (45 % / 500 px/s), rubber-band 0.15 and the reduced-motion opacity path; `animate` + `apple-design` §7: enter and exit along the same edge. Tokens are extended, not forked (Apple's 0.8 damping sheet spring is deliberately NOT introduced; the repo's `spring.sheet` bounce 0 / 0.35 s governs).
Alternatives rejected: multi-detent sheet (YAGNI); a new bottom-sheet component (duplicates `Sheet`).

**D17 — Translucent chrome material.**
Decision:
- Toolbar and capsule share `bg-white/90 dark:bg-surface/90 backdrop-blur-xl backdrop-saturate-150` plus a marker class `chrome-material`.
- `global.css` gets three fallback blocks for `.chrome-material`, mirroring the existing `.overlay-scrim` ones:
  - `@supports not (backdrop-filter)` → opaque `#fff` / `#0b0b10`;
  - `prefers-reduced-transparency` → opaque;
  - `prefers-contrast: more` → opaque + `1px solid currentColor` border.
- Every coloured state sits on an opaque layer: `ViewModeToggle`'s track gains `bg-white dark:bg-surface` (invisible change on Search, which sits on the same page colour), and the sort `<select>` is opaque. This follows `apple-design` §12: put colour on a solid layer, not the translucent foreground.

Contrast, computed against the **worst case** (solid black/white artwork directly under the 90 % layer; blur only averages towards the page colour):

| Pairing | Light (under = black → bg #e6e6e6) | Dark (under = white → bg #232328) | Floor |
|---|---|---|---|
| stone-900 / stone-100 text | 14.01 | 14.34 | 4.5 |
| stone-700 / stone-300 text | 8.23 | 10.50 | 4.5 |
| stone-500 border (Button secondary, toggle, select) | 3.84 | 3.26 | 3.0 |
| inactive toggle icon stone-500 / stone-400 | 3.84 | 6.20 | 3.0 |
| primary pill on opaque track (white / `surface`) | 6.29 | 3.14 | 3.0 |
| badge text stone-900 on amber `accent` (opaque) | 8.14 | 8.14 | 4.5 |

At 85 % alpha the dark border drops to 2.74 (fail) → 90 % is the minimum. The primary pill directly on dark material would be 2.49 → hence the opaque track. The record-count text lives in the page header (not on material): stone-500 on white 4.80, stone-400 on `surface` 7.88.
Alternatives rejected: an opaque toolbar like `AppHeader` (fails FR-016/FR-018 "translucent"); 20 px/180 % from the skill's example (visually equivalent; Tailwind's `backdrop-blur-xl` = 24 px keeps to the utility scale).

**D18 — Geometry, stickiness, safe areas.**
Decision:
- **Bar, below 640 px (capsule)**: `fixed inset-x-0 bottom-[calc(1rem+env(safe-area-inset-bottom))] z-30 mx-auto flex w-fit items-center gap-2 rounded-full p-2 shadow-lg ring-1 ring-stone-950/5 dark:ring-white/10` (constitution: `shadow-lg` for floating elements). All children are ≥ 44 px, so the capsule height is 60 px.
- **Clearance**: `:root { --capsule-clearance: calc(6rem + env(safe-area-inset-bottom)); }` next to `--header-h`; `<main>` gets `pb-(--capsule-clearance) sm:pb-8` (FR-019).
- **Same bar, ≥ 640 px (toolbar)**: `sm:sticky sm:inset-x-auto sm:bottom-auto sm:top-(--header-h) sm:mx-0 sm:h-15 sm:w-full sm:gap-3 sm:rounded-2xl sm:px-3 sm:shadow-none`. It is placed in `<main>` right after the header, so it spans the page's content width: `max-w-4xl` below 1280 px and `xl:max-w-7xl` from 1280 px (FR-018, as amended to ≥ 1280 px). The DOM position also gives the tab order header → bar → records.
- **Scroll padding**: an effect in `LibraryListPage` sets `scroll-padding-top: calc(var(--header-h) + 3.75rem)` and `scroll-padding-bottom: var(--capsule-clearance)` on `<html>` while mounted and clears them on unmount (the `FeedArticleBoard` pattern). Keyboard focus therefore never lands under the chrome.
- **Scroll edge**: no new treatment (the header's existing scroll-edge shadow plus the toolbar's material are enough; `apple-design` §12 warns against stacking dividers).

**D19 — Motion inventory (`animate` gate).**
| Element | Animate? | How | Reduced motion |
|---|---|---|---|
| Bottom sheet enter/exit/drag | Yes (occasional; spatial consistency) | `spring.sheet` in/out on Y; drag 1:1; fling → `spring.momentum` | existing Overlay opacity-only path (FR-027) |
| Filters side drawer | Yes (existing) | unchanged `Modal position="end"` | existing |
| Press on every control | Yes (feedback) | existing `pressable` (`scale 0.97`, 130 ms `--ease-out`) | scale dropped, brightness kept |
| View toggle pill | Yes (existing) | `spring.default` | jump |
| `<details>` facet disclosure | No | native, instant | — |
| Native select | No | OS | — |
| Capsule / toolbar appearance | No | always present | — |
| Skeleton → cards, new batch | No | instant swap (tens/day; motion would delay reading) | — |
| List restart on sort/filter | No (FR-022 cut) | instant `window.scrollTo({ top: 0 })` then new first batch | — |
| Badge count, end message, announcements | No | text change | — |

**D20 — Skeletons and CLS = 0.**
Decision:
- Skeleton items for the next batch render **inside the same `<ul>`** after the loaded items (not a second list), so they take exactly the next grid cells.
- The initial state uses 8 skeletons; a next batch uses `min(20, totalItems − loaded)` so a short last batch does not reserve rows that then collapse.
- The end message, retry block and sentinel follow the list, and nothing is inserted above loaded content.
- `RecordCard`'s cover already reserves its box (`aspect-square` on the `<img>` and on its placeholder) — keep as is. The same holds for the list row's fixed `h-16/h-20` thumb.

Rationale: SC-001 measures shifts of already-visible content, and appending below the viewport never shifts it.

**D21 — Announcements (FR-008, FR-021a, FR-028).**
Decision: one `<p role="status" class="sr-only">` in `LibraryListPage`, text set from effects:
- when the first page for a new key settles:
  - sort changed → `"Sorted by {announcement}."`;
  - filters changed → `"Showing {N} records."`, singular for 1;
- a later page settles → `"{k} more records loaded."`, with `" End of collection, {N} records."` appended when `!hasNextPage`;
- a first page that is also the last (a single-batch result, on initial load or after a sort/filter change) gets **no** end announcement: only the sort or filter text above, or nothing on initial load. The visible end message still renders;
- initial page load announces nothing.

Failures use the visible `role="alert"` retry block. Focus is never moved.
Rationale: announce only once results render (spec edge case "rapid changes").

**D22 — e2e specs relying on the old UI.**
Decision:
- `library-list-responsive.spec.ts`: the Next button flow becomes scroll-triggered loading (US2).
- `library-filters.spec.ts`: Apply becomes live filters in the drawer and sheet (US3).
- Cases whose subject is **Library's own overlay** move to the Library "Filters" drawer (still an `Overlay`, `data-variant="end"`) (US3):
  - `overlay-focus-management.spec.ts` (Library genre-modal case);
  - `overlay-contrast.spec.ts` (overlay over busy covers);
  - `reduced-motion.spec.ts` (Library overlay case).
- Cases whose subject is a **shared primitive that Library no longer shows** move to `/app/search`, which keeps the collapsible `FiltersControl` and the centred `SelectableListFilter` modal unchanged (US3). Moving them keeps the primitive covered; re-pointing them at the drawer would silently drop coverage of the centred modal and the disclosure.
  - `motion-performance.spec.ts`: "centered Modal enter + exit spring" (~L250–L262) and "CollapsibleFilterPanel disclosure" (~L312–L316);
  - `dark-mode-contrast.spec.ts`: the Genre modal surface contrast (~L139–L140);
  - `reduced-motion.spec.ts`: the "CollapsibleFilterPanel disclosure body" case (~L172–L187).
- `view-mode-toggle.spec.ts` needs no change, because `ViewModeToggle` is mounted once (D15). Its testids and the response shape are unchanged; verify only.

New specs: `library-sort-scroll.spec.ts` and `library-toolbar.spec.ts` (see [quickstart.md](./quickstart.md)).
