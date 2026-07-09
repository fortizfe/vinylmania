# Research: Search Results Organization

All items in the Technical Context were resolvable from the existing codebase and the spec's Clarifications session — no open `NEEDS CLARIFICATION` markers remain.

## 1. Sticky header implementation

**Decision**: Add `sticky top-0 z-40` (plus an explicit background: `bg-white dark:bg-gray-950`) to the existing `<header>` element in `AppHeader.tsx`. No wrapper/layout restructuring is needed.

**Rationale**: `AuthenticatedLayout` (`frontend/src/App.tsx`) renders `<AppHeader />` directly above page `children` with no intermediate scroll container — the whole document scrolls. CSS `position: sticky` relative to the normal document flow is therefore sufficient; there is no nested `overflow` ancestor that would require `position: fixed` plus manual content offset (`padding-top`) instead. `z-40` keeps the header below the existing `Modal` overlay (`z-50`, `frontend/src/components/ui/Modal.tsx`) so future modals/toasts still stack above it. An explicit background is required because the header currently has no `bg-*` class — content would show through/behind it once it stops scrolling away.

**Alternatives considered**:
- `position: fixed` + manual `padding-top` on page content — rejected: requires touching every page/layout to add offset padding and keep it in sync with header height (e.g., on responsive breakpoints where the header wraps), whereas `sticky` needs zero changes to page content.
- A new shared scroll-container wrapper (`<div className="overflow-y-auto h-dvh">`) with the header outside it — rejected: larger blast radius (would change scroll behavior for every existing page, e.g., anchor links, browser scroll-restoration) for no added benefit over plain `sticky`.

## 2. Infinite scroll mechanism

**Decision**: Replace `useCatalogSearch`'s `useQuery` (page-based) with TanStack Query's `useInfiniteQuery`, keyed on `(query, type, perPage, filters)` — i.e., the same key as today minus `page` — with `getNextPageParam` derived from the existing `pagination.pages`/`pagination.page` fields. Trigger `fetchNextPage()` from a sentinel `<div>` observed with a plain `IntersectionObserver` (via a small `useIntersectionObserver`-style hook or inline `useEffect`) placed after the last rendered result card.

**Rationale**: `@tanstack/react-query` v5 is already a project dependency (`frontend/package.json`) and ships `useInfiniteQuery` with exactly the accumulate-pages-and-flatten semantics User Story 2 needs, including built-in `isFetchingNextPage`/`hasNextPage` flags that map directly to FR-006/FR-007/FR-008. Because the query key excludes `page` and includes `query`/`filters`, changing the search term or a filter naturally produces a *different* infinite query — React Query starts it fresh with no manual "clear accumulated results" bookkeeping required, directly satisfying FR-009. `IntersectionObserver` is a native browser API already implicitly relied upon for standard scroll-triggered UX patterns and needs no new dependency, keeping the change aligned with Principle III (Simplicity/YAGNI).

**Alternatives considered**:
- A dedicated infinite-scroll/virtualization library (e.g., `react-virtuoso`, `react-window`) — rejected: pulls in a new dependency and virtualization/windowing was explicitly ruled out of scope (spec Assumptions: no virtualization needed for this increment); `useInfiniteQuery` + `IntersectionObserver` fully covers the requirements without one.
- `window.onscroll` height/offset math to detect "near the bottom" — rejected: `IntersectionObserver` is the standard, more efficient (non-scroll-jank) mechanism for this exact pattern and avoids manual threshold math scattered across scroll handlers.

## 3. Master-first ordering placement

**Decision**: Apply the masters-first reorder in `backend/src/routes/discogs.ts`, immediately before `res.status(200).json(result)` (currently line ~68), by reusing the `releaseResults`/`masterResults` arrays the handler already computes for its logging call (lines ~52-53) and responding with `{ ...result, results: [...masterResults, ...releaseResults] }` instead of the original `result.results` order.

**Rationale**: The route handler already partitions results into `releaseResults`/`masterResults` for its log line — reusing that partition to also reorder the response is a one-line change with no new computation. Doing this at the route (not inside `searchCatalog`/the cache layer) keeps the Redis cache-aside layer storing the raw, Discogs-shaped page exactly as returned by Discogs (ordering is presentation/response-shaping, not catalog data), preserving Principle II's modularity boundary between "Discogs integration" and "API response shaping." It also naturally satisfies the clarified best-effort, per-batch-only scope: each page/batch is reordered independently as it's produced, with no cross-batch/cross-page work and no extra Discogs requests.

**Alternatives considered**:
- Sorting client-side in `SearchResultsPage`/the infinite-scroll hook after each page arrives — rejected: would duplicate the release/master partition logic that already exists server-side, and would need to run once per accumulated page anyway (no simpler than doing it once at the source).
- A global, cross-batch stable sort re-run over the entire accumulated result list — explicitly rejected in Clarifications (Q1 → Option A: best-effort per-batch, no extra API calls) as it would require additional Discogs requests and would reshuffle already-rendered/scrolled-past cards.

## 4. Format badge removal on master cards

**Decision**: In `SearchResultCard.tsx`, gate the existing format `<Badge>` (currently unconditional at line ~69) behind the already-existing `isGrouped` flag (`result.resultType === 'master'`): render it only `{!isGrouped && format && <Badge tone="muted">{format}</Badge>}`.

**Rationale**: `isGrouped` already exists and already gates other master-specific rendering (stacked-cover visual, hiding `ResultCardActions`) — extending the same flag to the format badge is consistent with the component's existing conditional pattern and requires no new state or prop.

**Alternatives considered**: None material — this is a direct, minimal extension of an existing conditional; no other approach was considered.
