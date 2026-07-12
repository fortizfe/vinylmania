# Implementation Plan: Theme Personality Rebuild (Light & Dark Mode)

**Branch**: `039-theme-personality-rebuild` | **Date**: 2026-07-12 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/039-theme-personality-rebuild/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command. See `.specify/templates/plan-template.md` for the execution workflow.

## Summary

Rebuild the shared `@theme` foundation (`frontend/src/styles/global.css`) and
apply it across all 10 existing screens + `AppHeader` + the 11 shared atomic
UI components: replace the cool `gray-*`/`slate-*` neutral scale with
Tailwind's built-in warm-neutral `stone` scale, generalize the landing-only
near-black surface (`#0b0b10`) and amber accent (`#f59e0b`) into app-wide
tokens (indigo stays the sole primary-action color; amber becomes the
secondary accent), and widen the `Anton` display typeface from wordmark-only
to page/pillar/single-record-showcase titles. This is a visual-only rebuild
(no data, routing, or business-logic changes) that also amends the
constitution's "Visual lightness" rule, which currently mandates the opposite
(reduced gray/slate palette, single accent) — see `research.md` for the exact
token values, WCAG AA verification, and the drafted amendment text.

## Technical Context

**Language/Version**: TypeScript (React 19.2, `frontend/`); no backend changes.

**Primary Dependencies**: Tailwind CSS v4 (`@tailwindcss/vite`), `clsx`,
`react-router-dom`. No new dependencies are added — the warm-neutral `stone`
scale is already part of Tailwind v4's default palette; `Anton` is already
loaded via Google Fonts (`index.html`, feature 034).

**Storage**: N/A — no data model changes (FR-012).

**Testing**: Vitest + React Testing Library (`frontend/tests`, unit/component)
and Playwright (`/e2e`, per the constitution's mandatory e2e gate). Both
existing suites must stay green; only snapshot/selector adjustments are
expected where a test literally asserts a `gray-*`/`slate-*` class name
(SC-004).

**Target Platform**: Web browser, responsive (desktop + mobile), matching the
existing Vinylmania frontend's dual-layout requirement — unchanged by this
feature.

**Project Type**: Web application (frontend + backend). This feature is
frontend-only; `backend/` is untouched.

**Performance Goals**: No performance regression. Font loading strategy
(`font-display: swap`) is unchanged; the only new constraint is that widening
`Anton`'s scope to page headers must not introduce cumulative layout shift
(CLS) — mitigated via fixed `text-*`/`leading-*` utilities on in-scope
headings (research.md §5).

**Constraints**: Every new/modified text-background pairing MUST meet WCAG 2.1
AA (4.5:1 normal text, 3:1 large text/non-text — FR-010, verified in
research.md §4). Zero functional/business-logic/routing changes (FR-012). The
constitution amendment (FR-011) MUST land before or together with this
feature's merge (SC-005).

**Scale/Scope**: `@theme` token block (1 file) + 13 shared atomic UI
components (`frontend/src/components/ui/`) + 10 pages
(`frontend/src/pages/`) + `AppHeader` and its sub-components + the
constitution's "UI Design System & Styling" section. ~43 frontend `.tsx`
files currently reference `gray-*`/`slate-*` utilities (mechanical swap
target, see research.md §1).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

This feature is the rare case where the constitution itself is amended as
part of the same increment (FR-011), because the current "Visual lightness"
rule (v2.3.0) directly conflicts with the HU's request (it mandates a
*reduced* gray/slate palette + single accent; this feature asks for a warm
multi-accent palette). The gate below is evaluated against the **amended**
rule text drafted in `research.md` §7, which this plan commits to landing in
the same PR — consistent with the HU's explicit instruction that the
amendment "is delivered as part of the same increment as the visual rebuild,
not as a separate later step."

| Gate | Status | Notes |
|---|---|---|
| I. Test-First | ✅ PASS (adapted) | No new business logic exists to red/green. The regression-prevention equivalent is: (a) existing unit/e2e suites must stay green (SC-004), (b) the `grep gray-\|slate-` check in `quickstart.md` §3 acts as the pass/fail gate for SC-002, run before the corresponding implementation tasks are marked done. |
| II. Discogs Integration-First | ✅ N/A | No catalog-metadata changes. |
| III. Simplicity, YAGNI & KISS | ✅ PASS | Reuses Tailwind's built-in `stone` scale instead of hand-authoring a duplicate neutral scale (research.md §1); adds only 4 new `@theme` tokens (`--color-surface`, `--color-surface-raised`, `--color-border-dark`, `--color-accent-text`) plus 1 rename (`--color-accent`). |
| IV. SOLID Design | ✅ PASS | Token changes are centralized in `@theme`; component-level changes are class-name swaps within existing components, no new abstractions. |
| V. Observability | ✅ N/A | Visual-only change, no new operations to log. |
| VI. Versioning & Breaking Changes | ✅ PASS | No API/schema/data changes. Frontend `package.json` version is auto-bumped by the CI changelog pipeline (feature 037), not manually. |
| VII. Curated Ratings & Music News | ✅ PASS | Rating bands explicitly unchanged (FR-009); no news/feed changes. |
| UI Design System & Styling (amended) | ✅ PASS (post-amendment) | This feature's entire output is designed to satisfy the amended rule text (research.md §7): `@theme`-only tokens, `stone` neutrals, dual accent (indigo primary / amber secondary), widened but scoped `Anton` usage with a no-CLS rule, soft shadows unchanged, all other bullets (card layout, atomic components, skeletons, no-layout-shift, dual responsive layout, touch targets, v4-current utilities, no-custom-CSS) left untouched. |
| Dependent templates/docs | ✅ PASS | `.specify/templates/*.md` contain no `gray`/`slate`/"Visual lightness" references (verified by grep) — no propagation needed beyond `constitution.md` itself, matching the precedent set by the 2.3.0 amendment's Sync Impact Report. |

**Re-check after Phase 1 design**: No new violations introduced by
`data-model.md` or `quickstart.md` — both are consistent with the token model
above. Gate re-confirmed PASS.

## Constitution Amendment

Drafted in full in `research.md` §7 (replacement "Visual lightness" text +
appended "Theme-variable dark mode" clause, version `2.3.0` → `2.4.0`,
MINOR). Applying it to `.specify/memory/constitution.md` (with its `Sync
Impact Report`) is an implementation task, tracked in `tasks.md`, and must be
merged before or together with the rest of this feature per SC-005.

## Project Structure

### Documentation (this feature)

```text
specs/039-theme-personality-rebuild/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command) — design token model, no data entities
├── quickstart.md        # Phase 1 output (/speckit-plan command) — manual + automated validation guide
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

No `contracts/` directory: this feature introduces no API, contract, or
interface changes (FR-012) — it is a CSS token + Tailwind class-name rebuild
of an existing web app, not a new external-facing surface.

### Source Code (repository root)

```text
backend/                              # UNTOUCHED by this feature
└── ...

frontend/
├── index.html                        # Anton font <link> — unchanged loading strategy
└── src/
    ├── styles/
    │   └── global.css                # @theme block — token additions/renames (research.md, data-model.md)
    ├── theme/
    │   ├── ThemeContext.tsx          # UNTOUCHED — same light/dark mechanism (out of scope)
    │   └── useThemePreference.ts     # UNTOUCHED
    ├── components/
    │   ├── ui/                       # 13 shared atomic components — class-name/token swap only
    │   │   ├── Card.tsx, Button.tsx, Badge.tsx, Avatar.tsx, Input.tsx,
    │   │   │   Modal.tsx, Checkbox.tsx, Skeleton.tsx, StarRating.tsx,
    │   │   │   ReleaseRatingBadge.tsx, ThemeToggle.tsx, BackLink.tsx,
    │   │   │   InlineEditableField.tsx
    │   ├── brand/                    # VinylmaniaWordmark/Icon/GrungeFilter — UNTOUCHED (034 scope)
    │   ├── AppHeader.tsx              # gray/slate → stone + dark surface tokens
    │   └── ...                       # other shared components referencing gray-*/slate-*
    └── pages/                        # 10 pages — palette + in-scope title typography
        ├── LandingPage.tsx, DashboardPage.tsx, SearchResultsPage.tsx,
        │   LibraryListPage.tsx, WishlistPage.tsx, RecordDetailPage.tsx,
        │   ReleaseDetailPage.tsx, MasterReleaseDetailPage.tsx,
        │   ProfilePage.tsx, DiscogsCallbackPage.tsx

.specify/memory/
└── constitution.md                   # "Visual lightness" + "Theme-variable dark mode" amendment (v2.3.0 → v2.4.0)

e2e/                                  # Playwright suite — selector/snapshot adjustments only, no new flows
frontend/tests/                       # Vitest/RTL suite — same
```

**Structure Decision**: Existing "Option 2: Web application" layout
(`backend/` + `frontend/`), unchanged. This feature works entirely within
`frontend/src` (tokens, shared UI components, pages) plus one file outside
`frontend/`: `.specify/memory/constitution.md`. No new directories are
created; `backend/`, `e2e/` (aside from possible selector fixes), and
`frontend/tests/` (aside from possible selector fixes) are structurally
untouched.

## Complexity Tracking

*No entries* — the Constitution Check above passes against the amended rule
text with no unresolved violations. The one apparent "violation" (this
feature's palette/typography direction contradicts the *current*, v2.3.0
constitution) is resolved by amending the constitution itself as part of this
same increment (FR-011), not by requesting an exception to it — so no
Complexity Tracking justification applies.
