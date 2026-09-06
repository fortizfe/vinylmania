# Implementation Plan: Apple HIG Component Polish

**Branch**: `059-apple-hig-component-polish` | **Date**: 2026-09-05 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/059-apple-hig-component-polish/spec.md`

## Summary

Bring Vinylmania's entire shared component library up to Apple's Human Interface Guidelines design principles (Constitution Principle XI) without regressing WCAG 2.1 AA (Principle X) or the Tailwind design-system rules. The work is: (1) a written per-component audit (`audit.md`), (2) a small shared **motion + overlay layer** under `frontend/src/motion/` that wraps a single motion/gesture library (`motion`, formerly Framer Motion) and hand-rolled focus-trap / scroll-lock / focus-restore hooks, plus motion tokens in CSS, and (3) five independently shippable increments that apply that layer across the component set: instant press feedback (P1), physical interruptible transitions (P1), overlay depth + focus management (P2), touch gestures — drag-to-dismiss sheets and gallery swipe (P2), and one consistent interaction + typography language (P2). Every changed user flow gets Playwright e2e coverage; accessibility and contrast suites are the non-negotiable gate.

## Technical Context

**Language/Version**: TypeScript ~6.0, React 19.2, targeting ES2022 / modern evergreen browsers

**Primary Dependencies**: React 19, Tailwind CSS v4 (CSS-first `@theme`), TanStack Query 5, react-router-dom 6, `clsx`. **New**: `motion` (`motion/react`) — springs + drag/gesture + `AnimatePresence` + `useReducedMotion`, consumed only through `frontend/src/motion/`.

**Storage**: N/A (no persistence change; theme preference persistence is unchanged)

**Testing**: Vitest 4 + React Testing Library 16 + `@testing-library/user-event` (component/unit); Playwright + `axe-core` + `e2e/helpers/contrast.ts` (e2e, accessibility, contrast)

**Target Platform**: Responsive web — desktop (precise pointer) and mobile (touch-first); light + dark themes via `.dark` class on `<html>`

**Project Type**: Web application — this feature is **frontend-only** (`frontend/` + `e2e/`); no `backend/` change

**Performance Goals**: Sustained 60 fps during every transition on a mid-tier device modeled as ≈4× CPU throttling (~16 ms frame budget); animate only `transform` / `opacity` / `filter`; degrade to a simpler transition when the budget is exceeded (FR-022 / SC-010)

**Constraints**:
- Zero WCAG 2.1 AA regressions — automated axe + contrast + keyboard + accessible-name + heading-order checks pass at ≥ the pre-change rate on both themes (FR-018 / SC-005)
- No `tailwind.config.js`; all tokens in the CSS `@theme` / `@layer` (constitution CSS-first rule)
- 44×44 px touch targets, skeleton-first loading, no-layout-shift, dual responsive layouts, current v4 utility names — all preserved (FR-019)
- One motion/gesture library only, wrapped; trivial state (hover, show/hide, pressed) stays CSS-only (FR-006a, clarification 2026-09-05)
- `prefers-reduced-motion`, `prefers-reduced-transparency`, `prefers-contrast` all honored (FR-005; apple-design §14)

**Scale/Scope**: ~15 atomic (`ui/`) + ~40 composite + 3 brand components in `frontend/src/components/`; 1 new `frontend/src/motion/` module (~6 files); `frontend/src/styles/global.css` motion/type tokens; ~8 new or extended `e2e/` specs. Delivery in 5 story increments on the single feature branch.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Gate | Status |
|-----------|------|--------|
| **I. Test-First (NON-NEGOTIABLE)** | Every component change and every e2e flow has a failing test written and approved first (Red-Green-Refactor). Press-state, motion-token, reduced-motion, focus-trap, scroll-lock, and gesture behaviors each get a test that would fail today. | ✅ PASS — planned; tasks.md will order tests before implementation per story. |
| **III. Simplicity, YAGNI & KISS** | One new dependency (`motion`) — the smallest cohesive way to get interruptible velocity-aware springs + drag; focus-trap / scroll-lock / focus-restore are hand-rolled (~40 lines each) rather than adding more deps; the `motion/` wrapper is the only abstraction and exists to satisfy IV + FR-006a. | ⚠️ JUSTIFIED — see Complexity Tracking. No speculative options, no config surface beyond the token set the spec requires. |
| **IV. SOLID** | `motion/` wrapper is the single seam that imports `motion` (Dependency Inversion); each primitive (`Overlay`, `Sheet`, token module, hooks) has one responsibility; components depend on the wrapper's API, not the library. | ✅ PASS |
| **V. Observability** | UI-only; no new operations needing structured logs. Reduced-motion / reduced-transparency fallbacks are CSS-driven, not runtime branches worth logging. | ✅ PASS (N/A) |
| **VI. Versioning & Breaking Changes** | `Modal` gains focus-trap / scroll-lock / motion and `position="end"` becomes drag-dismissible — all **additive**, no prop removed or repurposed, no data schema touched. MINOR. Changelog + version bump are CI-generated — not hand-edited (Dev Workflow rule). | ✅ PASS |
| **VIII. Hexagonal Architecture — Backend** | No `backend/` change. | ✅ PASS (N/A) |
| **IX. Frontend Network Requests — Backend-Only** | `motion` is a client-side animation library; it initiates no network request. No new data fetching. | ✅ PASS |
| **X. Accessibility — WCAG 2.1 AA (NON-NEGOTIABLE)** | Net improvement: adds focus trap, focus restoration, scroll lock, reduced-motion compliance, and contrast verification of overlay content over blur. Existing focus-ring pattern (`ring-2 ring-primary ring-offset-2`) and all spec-058 contrast decisions are preserved constraints. Any conflict with Apple guidance → Apple guidance yields. | ✅ PASS — enforced by the existing axe + `contrast.ts` e2e gate, extended in this feature. |
| **XI. Apple Design Principles Compliance** | `apple-design`, `emil-design-eng`, and `animate` skills consulted; per-component rationale recorded in `audit.md`; motion uses spring/`--ease-*` tokens (no ad-hoc linear/`ease` CSS); enter/exit paths mirrored; overlays use translucent material + dimming scrim; typography gets size-specific tracking/leading. | ✅ PASS — this feature *is* the Principle XI conformance pass. |
| **UI Design System & Styling (Tailwind v4)** | Motion tokens added to the CSS `@theme` block / a justified `@layer`; `backdrop-blur-*`, `bg-linear-*` are current v4 utilities; `<Card>` / atomic-component centralization respected (new primitives are components, not inline utility repetition); skeleton, no-layout-shift, 44×44, dual-layout rules untouched. | ✅ PASS — one documented exception: motion custom properties + `@media (prefers-reduced-*)` blocks in `global.css` (rationale: springs require JS; the CSS side is theme tokens + media queries, not ad-hoc component CSS). |
| **Development Workflow (Quality Gates)** | Frontend changes → e2e coverage for every affected flow (theme toggle, view-mode toggle, header/menu, filters, gallery, inline edit, sign-in). Conventional Commits. No manual changelog/version edits. | ✅ PASS — planned in every story phase. |

**Result**: PASS with one justified complexity item (the `motion` dependency). No gate blocked.

## Project Structure

### Documentation (this feature)

```text
specs/059-apple-hig-component-polish/
├── plan.md              # This file
├── spec.md              # Feature spec (+ Clarifications)
├── research.md          # Phase 0 — motion library choice, token values, focus-trap/scroll-lock approach, overlay material, typography
├── audit.md             # Per-component audit table (FR-016) — disposition / HIG principle / skill consulted / target story
├── data-model.md        # Phase 1 — design entities: Motion Token, Interaction Pattern, Elevation/Material Treatment, Component Audit Entry
├── quickstart.md        # Phase 1 — how to validate each story (commands, expected outcomes)
├── contracts/
│   ├── motion-layer.md   # API contract for frontend/src/motion/ (tokens, MotionProvider, Overlay, Sheet, hooks)
│   └── component-api-changes.md  # Additive prop/behavior contracts for Modal, GalleryFullscreenViewer, toggles, etc.
└── checklists/
    └── requirements.md  # Spec quality checklist (from /speckit-specify)
```

### Source Code (repository root)

```text
frontend/
├── src/
│   ├── motion/                        # NEW — the only place `motion` is imported
│   │   ├── tokens.ts                  # spring configs + duration/easing constants (mirror global.css --motion-*/--ease-*)
│   │   ├── MotionProvider.tsx         # <LazyMotion features={domAnimation}> + <MotionConfig reducedMotion="user">
│   │   ├── Overlay.tsx                # translucent dimmed backdrop + focus trap + scroll lock + focus restore + AnimatePresence
│   │   ├── Sheet.tsx                  # drag-to-dismiss panel (drag axis, offset/velocity thresholds, rubber-band, scroll-boundary disambiguation)
│   │   ├── useFocusTrap.ts            # hand-rolled; no new dep
│   │   ├── useScrollLock.ts           # hand-rolled; body overflow + scrollbar-gutter compensation
│   │   └── useRestoreFocus.ts         # hand-rolled; capture activeElement on open, restore on unmount
│   ├── components/
│   │   ├── ui/                        # Button, Card, Modal, Input, Checkbox, Badge, Avatar, Skeleton, BackLink,
│   │   │                              #   StarRating, ThemeToggle, ViewModeToggle, ReleaseRatingBadge, InlineEditableField, icons/
│   │   ├── filters/                   # CollapsibleFilterPanel, SelectableListFilter, FilterActions
│   │   ├── brand/                     # VinylmaniaIcon, VinylmaniaWordmark, VinylmaniaGrungeFilter (review-only)
│   │   └── *.tsx                      # ~40 composite components (headers, cards, rows, feed, release/master sections, gallery)
│   ├── styles/
│   │   └── global.css                 # ADD: --ease-out/-in-out/-drawer, --motion-* spring/duration tokens,
│   │                                  #      --tracking-*/--leading-* display-type tokens, @media (prefers-reduced-motion|transparency|contrast)
│   ├── theme/                         # ThemeContext (unchanged); MotionProvider mounts alongside ThemeProvider
│   └── hooks/                         # useEscapeKey (kept; Overlay composes it)
└── tests/unit/                        # Vitest — ui/ + motion/ + composite component tests

e2e/
├── helpers/                           # axe.ts, contrast.ts (extended with over-blur checks), theme.ts
└── tests/
    ├── reduced-motion.spec.ts         # NEW — prefers-reduced-motion: no transform/scale motion, no skeleton pulse
    ├── overlay-focus-management.spec.ts  # NEW — focus trap / restore / scroll lock for modal, drawer, gallery
    ├── sheet-drag-dismiss.spec.ts     # NEW — drawer/sheet 1:1 drag, threshold dismiss, spring-back, scroll disambiguation
    ├── gallery-swipe.spec.ts          # NEW — horizontal swipe changes image, thumbnail sync, keyboard/button parity
    ├── press-feedback.spec.ts         # NEW — pressed state on pointerdown for representative controls
    ├── theme-preference.spec.ts       # EXTEND — spring knob motion + reduced-motion
    ├── view-mode-toggle.spec.ts       # EXTEND — shared-element pill motion + reduced-motion
    ├── header-responsive-nav.spec.ts  # EXTEND — hamburger drawer material + gesture + focus
    ├── library-filters.spec.ts / search-result-filters.spec.ts  # EXTEND — disclosure motion
    ├── release-detail-responsive.spec.ts / release-detail.spec.ts  # EXTEND — gallery viewer material + swipe
    └── record-detail-inline-edit.spec.ts  # EXTEND — inline-edit trigger press state
```

**Structure Decision**: Web application, frontend-only slice. All new code lives under `frontend/src/motion/` (new, dependency-isolating) and touches `frontend/src/components/**`, `frontend/src/styles/global.css`, and `e2e/tests/**`. No `backend/` or `api/` involvement. The `motion/` module is a deliberate fourth sibling to `components/`, `hooks/`, `theme/` — it is infrastructure (the wrapped library + a11y primitives), not a UI component, so it does not belong under `components/`.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| New runtime dependency: `motion` (~30 kB gzip, tree-shaken via `LazyMotion`/`m`) | HIG-grade motion requires interruptible springs that animate from the *presentation* value, velocity hand-off between drag and animation, momentum projection, and 2D drag with rubber-banding (apple-design §3–§9). Doing this correctly across ~15 animated components is a substantial, bug-prone amount of hand-rolled physics + Pointer Event plumbing. | **CSS-only + hand-rolled gestures**: CSS transitions "can't be smoothly grabbed and reversed mid-flight" (apple-design §3) — they fail FR-004 (interruptibility) by construction; hand-rolling springs with velocity blending is more code and more risk than one wrapped, well-tested library. **`react-spring` + `@use-gesture`**: two dependencies instead of one, with drag/spring integration left to us; `motion` bundles both cohesively and its `bounce`+`duration` spring API maps directly to Apple's damping/response (apple-design §4). |
| New module `frontend/src/motion/` (wrapper layer, not a component) | Constitution IV (Dependency Inversion) + FR-006a require that no component import `motion` directly and that the library be swappable. One shared seam also centralizes the reduced-motion/reduced-transparency handling so it can't be forgotten per-component. | Importing `motion` directly in each component scatters the dependency across ~15 files, makes FR-006a unenforceable, and duplicates reduced-motion guards. |
| Motion custom properties + `@media (prefers-reduced-*)` in `global.css` | Motion tokens must be shared between CSS-only transitions (press, simple fades) and the JS spring layer; `@media` preference queries have no Tailwind-utility equivalent for globally neutralizing motion. | Per-component inline durations/curves violate FR-006 and the constitution's "no utility combination repeated twice" rule; a `tailwind.config.js` is explicitly disallowed by the CSS-first rule. |

All three items are scoped to the minimum needed by the spec's functional requirements and are recorded in the PR description per the Development Workflow gate.

## Phase 0 — Research

See [research.md](./research.md). Resolves: motion library selection and bundle strategy; exact spring/easing/duration token values (from `animate` skill tables); focus-trap and scroll-lock implementation approach (hand-rolled vs. dependency); overlay material treatment and the `backdrop-filter`-unsupported / `prefers-reduced-transparency` fallbacks; whether to make sticky headers translucent (and the documented decision where it conflicts with the near-black surface-token rule); typography tracking/leading token scale; drag-dismiss threshold constants; test strategy for interruptibility and 60 fps.

## Phase 1 — Design & Contracts

- [data-model.md](./data-model.md) — the four design entities and their fields/relationships/validation rules.
- [contracts/motion-layer.md](./contracts/motion-layer.md) — the `frontend/src/motion/` public API (tokens, `MotionProvider`, `Overlay`, `Sheet`, hooks) with prop shapes and behavioral guarantees.
- [contracts/component-api-changes.md](./contracts/component-api-changes.md) — additive, backward-compatible prop/behavior changes to `Modal`, `GalleryFullscreenViewer`, `ThemeToggle`, `ViewModeToggle`, `CollapsibleFilterPanel`, `Button`, and the shared focus-ring utility.
- [audit.md](./audit.md) — every in-scope component with a disposition (`conforms` / `refine` / `rework`), the HIG principle at stake, the skill consulted, and the story that delivers its change.
- [quickstart.md](./quickstart.md) — per-story validation commands and expected outcomes.

Agent-context update script (`update-agent-context.sh`) is not present in this repo and there is no `CLAUDE.md` / `AGENTS.md`; this step is skipped (no agent guidance file to sync).

## Post-Design Constitution Re-Check

Re-evaluated after Phase 1 artifacts: no new violations. The `motion` dependency and `motion/` module remain the only complexity items, both justified above. Contracts keep all component changes additive (Principle VI stays MINOR). The overlay and reduced-motion primitives strengthen Principle X. **Gate: PASS.**
