# Implementation Plan: Header Search Bar Redesign — Instant Suggestions, WCAG 2.1 AA & Apple HIG

**Branch**: `069-header-search-redesign` | **Date**: 2026-09-21 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/069-header-search-redesign/spec.md`

## Summary

**Primary requirement**: the header search becomes a single, comfortably sized entry point at every width that expands with a physically believable settle over a blurred backdrop, and proposes up to 5 artist/album matches while the collector types — fully operable by keyboard and screen reader, and costing at most one Discogs request per lookup.

**Technical approach**, two slices, **no new dependencies**:

1. **Backend** (FR-010 – FR-020, SC-011). A new `GET /api/discogs/suggest` handler in the existing `discogsRoutes.ts`, backed by a new application use case and a new pure domain rule. It deliberately bypasses `searchCatalogWithRatings`, whose unconditional rating fan-out (up to 2 extra Discogs calls per hit) disqualifies it for a panel that fires while typing. One upstream `/database/search` call per cache miss, with the existing port widened by a single `resultType: 'any'` value so the **artist hits the adapter already receives and discards** become the artist suggestions. The 2-artists + 3-albums-with-cross-fill rule is a pure domain function. Results are cached at `discogs:suggest:{normalizedQuery}` for 5 minutes through the existing `cacheAdapter`, and the route gets its own rate-limit bucket so header typing cannot starve the catalog and detail routes.
2. **Frontend** (FR-001 – FR-009, FR-021 – FR-025). `HeaderSearchBox` gains an expanded state (`spring.sheet`), a non-modal backdrop reusing `.overlay-scrim` + `useScrollLock` + `useRestoreFocus`, and the repo's **first** WAI-ARIA combobox: `role="combobox"` + `aria-activedescendant`, with DOM focus never leaving the field — which is precisely what makes clarification 3's non-modal overlay work without a focus trap. A new `HeaderSuggestionPanel` renders the five states (idle/loading/suggestions/empty/error) at a fixed shape. A 300 ms debounce plus a per-query TanStack Query key make out-of-order responses structurally unrenderable. The submit-and-navigate path is untouched.

Decision log: [research.md](./research.md) D1–D18. Entities, quota table, glossary and state machine: [data-model.md](./data-model.md). Contracts: [suggest-api.md](./contracts/suggest-api.md), [header-search-ui.md](./contracts/header-search-ui.md). Validation: [quickstart.md](./quickstart.md).

## Technical Context

**Language/Version**:
- Backend: TypeScript 5.6 on Node (Express 4, deployed as a Vercel function).
- Frontend: TypeScript 6.0, React 19, Vite 8.

**Primary Dependencies**:
- Backend: `express`, `express-rate-limit` 8, `axios` (adapter only), `ioredis` (adapter only), `zod` (existing mappers). Reused: `cacheAdapter`/`CachePort`, `discogsCatalogAdapter`, `resolveCatalogCredential`, `requireAuth`, `respondDiscogsAuthError`, `rateLimitOptions`, `logger`.
- Frontend: `@tanstack/react-query` 5, `react-router-dom` 6, Tailwind CSS v4, `clsx`, `motion` 12 (only through `frontend/src/motion/`). Reused: `spring.sheet`, `motionDuration.fade`, `useScrollLock`, `useRestoreFocus`, `usePrefersReducedMotion`, `useEscapeKey`, `.overlay-scrim`, `Card`, `Input`, `Button`, `focusRing`, `pressable`, `buildSearchPath`.
- e2e: Playwright 1.61 + `@axe-core/playwright` 4.12, with the existing `helpers/{axe,focusRing,motion,contrast,theme}.ts`.
- **No new dependency in any package.**

**Storage**:
- Firestore: **not touched**. No schema change, no migration (Principle VI).
- Redis (via `CachePort`): one new key family `discogs:suggest:{normalizedQuery}`, TTL 300 s, holding the shaped ≤5-item payload. Disjoint from the existing `discogs:search:*` 30-minute family. Fail-soft — no Redis means every lookup goes upstream, and the request still succeeds.
- Browser: TanStack Query cache only, `staleTime` 5 min. No `localStorage`.

**Testing**:
- Backend: Jest (`backend/tests/{unit,contract}/discogsCatalog`). No Firebase emulator is needed for this feature — nothing touches Firestore.
- Frontend: Vitest 4 + RTL (`frontend/tests/{unit,integration}`).
- e2e: Playwright (chromium + webkit) + `@axe-core/playwright` (`e2e/tests`).

**Target Platform**: evergreen browsers from 360 px phones (safe-area insets) to wide desktop; backend as a Vercel serverless function.

**Project Type**: web application (backend + frontend + e2e).

**Performance Goals**:
- Suggestions painted within 1 s for a cached term and 2.5 s for a first-time term on a typical mobile connection (SC-003).
- ≤ 3 lookups per 10-character query; zero while typing continuously (SC-004) — enforced by the 300 ms debounce.
- **Exactly 1** Discogs request per cache miss, **0** per hit (SC-011, FR-017).
- Expansion settles in ~0.35 s with no overshoot (FR-002); 0 visible page movement and 0 panel resize between states (SC-008).

**Constraints**:
- WCAG 2.1 AA in both themes, in all five panel states, at 375 px and 1440 px (Principle X, SC-007).
- The phone overlay is **non-modal**: no `aria-modal`, no `role="dialog"`, no focus trap; only page scroll is suspended (clarification 3, FR-005).
- Activation with a pre-filled field must not trigger a lookup (clarification 4, FR-004).
- Every interactive control ≥ 44×44 CSS px at phone widths (SC-010).
- The browser talks only to Vinylmania's backend (Principle IX, FR-016).
- The existing submit-and-navigate behaviour, including filter re-application on the results screen, must be preserved unchanged (FR-008).
- `/api/discogs/search` and the results screen must not change (spec Out of scope: `VINYLMANIA-7`, `-8`, `-9`).

**Scale/Scope**:
- 1 new backend endpoint; 5 suggestions per lookup; upstream page size 20.
- 4 backend source files changed, 2 new.
- 4 frontend source files changed, 1 new.
- 1 new e2e spec, 3 updated.
- No screen added; one header component redesigned plus one new panel.

**No `NEEDS CLARIFICATION` remains**: the spec's Session 2026-09-21 fixed the five product questions, and research.md D1–D18 resolves every structural question the spec deferred to this phase (endpoint shape, where the quota rule lives, artist-hit reuse, cache, rate limit, ARIA pattern, observability, glossary).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Gate | Result |
|---|---|---|
| **I Test-First (NON-NEGOTIABLE)** | Every story's Tests block (backend unit + contract, Vitest unit + integration, Playwright e2e) is written, seen failing and approved before its Implementation block. Named suites: `suggestionQuota` truth table, `suggestCatalogMatches` (one upstream call, cache key/TTL, short-circuit), `searchCatalog` `resultType: 'any'`, `suggest.contract`, `HeaderSuggestionPanel`, `HeaderSearchBox`, `discogsQueries`, `headerSearchFlow`, `header-search.spec.ts`. | PASS |
| **II Discogs integration & rate limits** | The whole point of the separate endpoint: **1** upstream request per cache miss, **0** rating lookups (vs. up to 11 through `searchCatalogWithRatings`), a 5-minute shared cache with request coalescing, and its own rate-limit bucket so typing cannot starve the other catalog routes. Rate-limit, retry and circuit-breaker handling are inherited unchanged from `discogsCatalogAdapter`. No hand-curated catalog metadata. | PASS |
| **III Simplicity, YAGNI & KISS** | 0 new dependencies. 3 new source files, each justified in Structure Decision. 0 new ports, 0 new port methods (one enum value widened), 0 new adapter files, 0 new motion tokens, 0 new CSS, 0 new rate-limit constants, 0 new hook files. Cut and recorded in [research.md §3](./research.md): request cancellation, a shared debounce hook, a `kind` wire field, a `nonModal` prop on `Overlay`, a `suggest` rate-limit tier, credential-scoped cache keys, query-text logging. | PASS |
| **IV SOLID** | The quota rule is a pure domain function with one reason to change (SRP); the use case orchestrates and owns caching; the route only translates HTTP. The port is widened by one value rather than gaining a method (ISP). `HeaderSuggestionPanel` is split from `HeaderSearchBox` so presentation and interaction change independently. Everything depends on `DiscogsCatalogPort`/`CachePort`, never on axios or ioredis (DIP). | PASS |
| **V Observability** | One structured success line plus the file's three existing failure shapes, with `queryLength`, `artists`, `albums`, `returned` ([suggest-api.md §6](./contracts/suggest-api.md)). The query text is not logged, matching `/api/discogs/search`. | PASS |
| **VI Versioning & breaking changes** | A new endpoint and an additive `resultType: 'any'` on an internal port → **MINOR**. `/api/discogs/search` and its response are byte-for-byte unchanged (the per-mode raw-type filter stays per-mode precisely for this). No stored-data change, so no migration path is required. | PASS |
| **VII Ratings & news** | Ratings are deliberately **absent** from suggestions; the ratings on the full results screen are untouched. News not involved. | N/A |
| **VIII Hexagonal architecture** | `domain/discogsCatalog/suggestionQuota.ts` (pure rule, no HTTP, no SDK) → `application/discogsCatalog/suggestCatalogMatches.ts` (orchestration over `DiscogsCatalogPort` + `CachePort`) → `adapters/discogsCatalog/{discogsRoutes,discogsCatalogAdapter}.ts` (HTTP in, HTTP out). No SDK import outside adapters; the route contains no business logic — the allocation rule is why the quota lives in domain rather than in the handler. Layers use the existing global per-domain folders. | PASS |
| **IX Frontend → backend only** | The only network call is `GET /api/discogs/suggest` through the existing `authorizedFetch`. Thumbnails are passive `<img src>` (explicit carve-out). No Discogs SDK or URL in `frontend/`. | PASS |
| **X WCAG 2.1 AA (NON-NEGOTIABLE)** | Semantic HTML first (`<input type="search">`, `<ul>`/`<li>`, `<button>`), ARIA only where the combobox genuinely needs it. Full names/roles/states table, keyboard table (no trap at any width), announcement table and contrast floors in [header-search-ui.md §3–§8](./contracts/header-search-ui.md). Reduced motion, reduced transparency and increased contrast are all honoured. 44×44 everywhere. No state is colour-only — the artist/album label is text. axe runs in 5 states × 2 themes × 2 widths. SC-006 is automated per clarification 5. | PASS |
| **XI Apple design principles** | `apple-design` consulted before the design was fixed; conclusions recorded as research D11–D14 and [header-search-ui.md §7](./contracts/header-search-ui.md): critically damped spring with no overshoot because no momentum gesture precedes the expansion (§4); symmetric expand/collapse path (§7); translucent blurred backdrop as the depth cue, with content behind never stacked on a second translucent layer (§12); reduced motion as a gentler equivalent, not the absence of feedback (§14). `animate` / `emil-design-eng` were not separately invoked: **no new motion vocabulary is introduced** — every value is an existing spec-059 token, which is what the spec's Assumptions require. | PASS |
| **UI Design System & Styling** | Tailwind utilities only; **no new custom CSS** (`.overlay-scrim` already carries the three fallback media queries). No arbitrary values: `backdrop-blur-xl`, `sm:w-96`, `min-h-11 min-w-11` are all on-scale. The panel surface is the existing `<Card>`. Loading is a shape-matched skeleton, never a spinner. All five states share the panel's sizing, so no layout shift. Two purpose-built responsive layouts split at `sm:`, not one reflow. Stone palette with `--color-surface` tokens in dark mode; `shadow-lg` only on the floating panel. | PASS |
| **Additional Constraints: API documented before implementation** | [contracts/suggest-api.md](./contracts/suggest-api.md) fixes request, response, error codes, upstream cost, cache, rate limit and the contract-test list before any code. | PASS |
| **Workflow: e2e coverage for `/frontend` changes** | New `e2e/tests/header-search.spec.ts`; `header-responsive-nav`, `reduced-motion` and `dark-mode-contrast` updated. Written in each story's Tests block, before the code. | PASS |
| **Workflow: conventional commits, no manual changelog/version** | Phase commits come from `.specify/extensions/git/git-config.yml`; no `CHANGELOG.md` or `version` edits in this feature. | PASS |

**Post-design re-check** (after research, data-model, contracts and quickstart): no new violations, and no gate moved. The one deliberate cost is D13's width animation, recorded as a `ponytail:` ceiling with its upgrade path. **Gate: PASS.**

## Project Structure

### Documentation (this feature)

```text
specs/069-header-search-redesign/
├── plan.md                      # This file
├── research.md                  # D1–D18 decisions + current-state audit + what was cut
├── data-model.md                # Glossary, CatalogSuggestion, quota truth table, panel state machine
├── quickstart.md                # Backend / Vitest / Playwright validation
├── contracts/
│   ├── suggest-api.md           # GET /api/discogs/suggest: request, response, errors, cache, rate limit, logs
│   └── header-search-ui.md      # Layout, ARIA roles/states, keyboard, announcements, destinations, motion, contrast
├── checklists/requirements.md   # 16/16 green (unchanged by this phase)
└── tasks.md                     # /speckit-tasks (not created here)
```

### Source Code (repository root)

```text
backend/src/
├── domain/discogsCatalog/
│   ├── types.ts                          # CHANGE: + CatalogSuggestion (data-model §2)
│   └── suggestionQuota.ts                # NEW (D4): allocateSuggestions() — pure 2+3-with-cross-fill rule
├── application/discogsCatalog/
│   └── suggestCatalogMatches.ts          # NEW (D1): createSuggestCatalogMatchesUseCase({ discogsCatalog, cache })
│                                         #   → withCache('discogs:suggest:{norm}', 300, search(resultType:'any', perPage:20) → allocate)
├── ports/discogsCatalog/discogsCatalogPort.ts   # CHANGE (D2): SearchCatalogOptions.resultType += 'any'
└── adapters/discogsCatalog/
    ├── discogsCatalogAdapter.ts          # CHANGE (D2): 'any' sends no upstream `type` and keeps release|master|artist
    └── discogsRoutes.ts                  # CHANGE (D1, D6, D7): GET /suggest handler + its own suggestRateLimit instance + log line

backend/tests/
├── unit/discogsCatalog/domain/suggestionQuota.test.ts          # NEW: the data-model §3 truth table + invariants
├── unit/discogsCatalog/application/suggestCatalogMatches.test.ts  # NEW: 1 upstream call, no rating calls, cache key/TTL, <2-char short-circuit
├── unit/discogsCatalog/adapters/discogsCatalogAdapter.test.ts  # CHANGE: 'any' keeps artists, drops label, sends no `type`; 'release'/'artist' unchanged
└── contract/discogsCatalog/suggest.contract.test.ts            # NEW: the 10 cases in contracts/suggest-api.md §7

frontend/src/
├── components/
│   ├── HeaderSearchBox.tsx               # CHANGE: expanded state + spring.sheet, backdrop, scroll lock, focus return,
│   │                                     #   combobox ARIA, arrow/Enter/Escape handling, 300 ms debounce, hasEdited,
│   │                                     #   role="status" announcer, < 640 px icon-button entry point. Submit path untouched.
│   ├── HeaderSuggestionPanel.tsx         # NEW (D15): Card + <ul role="listbox"> with the 5 states and shape-matched skeletons
│   └── AppHeader.tsx                     # CHANGE: let the middle grid cell expand; mount the backdrop below the header (z-30)
├── services/discogsApi.ts                # CHANGE: suggest(query) via authorizedFetch + CatalogSuggestion type
└── queries/discogsQueries.ts             # CHANGE (D8): discogsKeys.suggest + useCatalogSuggestions (staleTime 5 min, retry: false)

frontend/tests/
├── unit/HeaderSearchBox.test.tsx         # CHANGE: expansion, pre-fill+select without lookup, keyboard table, announcements, collapse paths
├── unit/HeaderSuggestionPanel.test.tsx   # NEW: the 5 states, roles/ids, kind label is text, skeleton shape parity
├── unit/queries/discogsQueries.test.tsx  # CHANGE: suggest key, enabled gate, staleTime, retry: false
└── integration/headerSearchFlow.test.tsx # CHANGE: debounce count, stale-response discard, clear mid-flight, Escape×2, Enter both ways, Retry, destinations

e2e/tests/
├── header-search.spec.ts                 # NEW: SC-001..SC-011 — keyboard-only flow at 375/1440, axe matrix, 44 px,
│                                         #   scroll lock, no page movement, panel size stability, submit-still-works-on-failure
├── header-responsive-nav.spec.ts         # CHANGE: collapsed icon-button entry point below 640 px
├── reduced-motion.spec.ts                # CHANGE: + header search open/close case
└── dark-mode-contrast.spec.ts            # CHANGE: + header search panel states
```

**Structure Decision**: the feature stays entirely inside the existing per-domain folders — backend `{domain,application,ports,adapters}/discogsCatalog`, frontend `components/`, `services/`, `queries/`, and the `motion/` layer consumed without modification. **Three new source files**, each with a reason no existing file can absorb:

- `backend/src/domain/discogsCatalog/suggestionQuota.ts` — a pure business rule with its own truth table, exactly the shape of the existing `domain/library/librarySort.ts`. Putting it in the use case would hide a domain rule in the application layer; putting it in the route would be orchestration in an adapter (Principle VIII).
- `backend/src/application/discogsCatalog/suggestCatalogMatches.ts` — the second catalog use case. It cannot be a branch of `searchCatalogWithRatings` without forking that file's single responsibility down the middle (research D1).
- `frontend/src/components/HeaderSuggestionPanel.tsx` — the panel's five visual states are a separate reason to change from the field's interaction model, and they want their own RTL suite (research D15).

**No** new port, port method, adapter file, hook file, motion token, CSS class, dependency or rate-limit constant.

### Implementation notes for agents (pinned decisions; do not redesign)

- **Agents**: `backend-agent` owns `backend/**`; `frontend-agent` owns `frontend/**`; `qa-agent` owns `e2e/**` and the Test-First review; `docs-agent` has no end-user doc change beyond an optional FAQ line about instant suggestions.
- **Order**: the backend slice (domain rule → use case → port/adapter → route → contract tests) lands first because it fixes the wire contract. The frontend depends only on [suggest-api.md](./contracts/suggest-api.md), so it can start in parallel against mocks.
- **Do not** route suggestions through `searchCatalogWithRatings`, and **do not** change `/api/discogs/search`'s behaviour or response — the per-mode raw-type filter in `discogsCatalogAdapter` stays per-mode for that reason.
- **Do not** reuse `motion/Overlay`, `Sheet` or `useFocusTrap`: clarification 3 makes the search non-modal. Reuse `useScrollLock`, `useRestoreFocus`, `useEscapeKey` and the `.overlay-scrim` class.
- **Do not** adopt `layout` / `layoutId` (`motionFeatures.ts`'s standing warning); animate the form's `width` on `spring.sheet`.
- DOM focus **never** leaves the field while the panel is open — arrows move `aria-activedescendant` only.
- Arrowing past either end goes to "no active option", not wrap, so Enter can always submit the typed query.
- Suggestion text labels the kind ("Artist" / "Album"); an icon may accompany it but never replaces it.
- `ponytail:` markers to leave in code:
  - D13, `HeaderSearchBox.tsx`: animating `width` runs layout on the header row each frame; ceiling is a measurable header frame drop; upgrade path is `ViewModeToggle`'s measured-transform approach.
  - D5, `suggestCatalogMatches.ts`: the suggest cache entry is shared across collectors (no credential in the key, matching `discogs:search:*`); ceiling is Discogs personalising `/database/search`; upgrade path is adding the credential type to the key.
- **Local e2e**: the dev Redis in `backend/.env` is shared, so a stale `discogs:suggest:*` key can fail a local spec. Flush that prefix before a local run (see [quickstart.md](./quickstart.md)); CI is unaffected.
