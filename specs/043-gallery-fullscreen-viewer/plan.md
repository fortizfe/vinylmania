# Implementation Plan: Shared Image Gallery — Contained Size & Fullscreen Viewer

**Branch**: `043-gallery-fullscreen-viewer` | **Date**: 2026-07-14 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/043-gallery-fullscreen-viewer/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command. See `.specify/templates/plan-template.md` for the execution workflow.

## Summary

Fix two sizing/scroll bugs and add one new capability to the single shared
`ReleaseImageGallery` component (used by `ReleaseDetailPage`,
`MasterReleaseDetailPage`, and `RecordDetailPage`): (1) cap the main image's
desktop size with a `lg:max-w-md` self-contained width on the component's
root element — the current oversize comes from the component having no
`max-w` of its own, so it inherits the full width of its `lg:grid-cols-2
col-span-2` detail-page column before the `xl:grid-cols-3 col-span-1`
breakpoint narrows it (research.md Decision 1); (2) cap the thumbnail
column's height by adding `min-h-0` to its flex item, fixing the classic
flexbox bug where `overflow-y-auto` cannot shrink a child below its content's
intrinsic height without an explicit `min-height: 0` (research.md Decision
2); (3) add a fullscreen viewer, opened by making the main image an
unstyled `<button>` (mirroring the existing thumbnail-button pattern) that
toggles a new `isFullscreenOpen` state colocated with the existing
`selectedIndex` state, rendered as a new dedicated overlay component (not a
reuse of the padded, max-width `Modal`) that reuses two small pieces
extracted out of `Modal` for DRY: a shared `CloseIcon` and a shared
`useEscapeKey` hook (research.md Decision 3).

## Technical Context

**Language/Version**: TypeScript ~6.0.2 (frontend, Vite 8 + React 19.2)

**Primary Dependencies**: React 19.2, Tailwind CSS v4, `clsx` (existing
`ReleaseImageGallery`/`Modal` dependencies — no new dependency introduced)

**Storage**: N/A — no data/schema change; images continue to come from the
existing `release.images` / `master.images` (Discogs-sourced) props

**Testing**: Vitest + React Testing Library (frontend unit/component,
extends `frontend/tests/unit/ReleaseImageGallery.test.tsx`), Playwright
(`/e2e`, extends `e2e/tests/release-detail.spec.ts` and the
`*-responsive.spec.ts` specs for all three detail pages — mandatory per
constitution for any `/frontend` change)

**Target Platform**: Web application (desktop + mobile browsers), existing
dual-layout responsive convention

**Project Type**: Web application — frontend-only change within the
existing `frontend/` React app; no `backend/` change

**Performance Goals**: No new hard latency targets; no additional network
requests are introduced (fullscreen reuses already-loaded `<img>` sources)

**Constraints**: No visible scrollbar on the thumbnail column's internal
scroll (existing `scrollbar-hidden` utility, unchanged); 44×44px minimum
touch targets for the close control and thumbnails (constitution — existing
thumbnails already meet this via `min-h-11 min-w-11`); the main clickable
image and fullscreen close control must be keyboard-operable (native
`<button>` semantics); no change to `imageType === 'primary'` default
selection logic; resizing/orientation-change while fullscreen is open must
not close it or change the selection (FR-013)

**Scale/Scope**: One shared component (`ReleaseImageGallery.tsx`) plus one
new sibling component; 3 consuming pages get zero code changes (same props,
same testids); scope bounded to images already present in
`release.images`/`master.images` (no pagination/virtualization needed at
existing release-gallery sizes)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Check | Result |
|---|---|---|
| I. Test-First | New/updated Vitest+RTL coverage for contained sizing, capped+scrollable thumbnails, fullscreen open/close/navigate/keyboard, and Playwright e2e coverage for all three detail pages must be written before implementation | PASS (planned in tasks phase) |
| II. Discogs Integration-First & Modularity | No change to how images are sourced (`release.images`/`master.images`, Discogs-derived, untouched); this is a pure presentation change to an existing modular component | PASS |
| III. Simplicity, YAGNI & KISS | Two one-line CSS fixes (`lg:max-w-md`, `min-h-0`) for the sizing bugs; the fullscreen viewer is one new component with state colocated in the existing `ReleaseImageGallery`, no new global store, no zoom/pan, no swipe-gesture library (all explicitly out of scope per spec) | PASS |
| IV. SOLID | `ReleaseImageGallery` keeps a single responsibility (selection state + two presentations); the new fullscreen overlay is a separate component receiving props, not a modification of `Modal`'s internals; `CloseIcon`/`useEscapeKey` extraction is Open/Closed-friendly (both `Modal` and the new viewer depend on the same small abstractions instead of duplicating logic) | PASS |
| V. Observability | N/A — pure client-side presentational state (open/closed, selected index); no new operation worth structured logging (no network calls, no persisted state, consistent with how the existing gallery's selection state is already unlogged) | N/A |
| VI. Versioning & Breaking Changes | Additive/behavioral only: `ReleaseImageGallery`'s public props (`images`, `alt`) are unchanged, so all three call sites need zero changes; no schema/contract change | PASS |
| VII. Curated Ratings & Music News | Not applicable — this feature does not touch ratings or news surfaces | N/A |
| UI Design System (Tailwind v4, atoms, touch targets, dual layout) | Reuses existing `scrollbar-hidden` utility and the existing thumbnail-button visual pattern; new close control reuses the extracted `CloseIcon` + the existing `Button` atom (`size="icon"`); dual desktop/mobile behavior for both the contained sizing and the fullscreen viewer is required and testable (spec AC5, AC10) | PASS |
| e2e coverage gate | New Playwright coverage required for the fullscreen open/close/navigate flow and the thumbnail-scroll-cap behavior on all three detail pages before merge | PASS (planned in tasks phase) |

No violations requiring justification — Complexity Tracking table omitted.

## Project Structure

### Documentation (this feature)

```text
specs/043-gallery-fullscreen-viewer/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/           # Phase 1 output (/speckit-plan command)
│   └── ReleaseImageGallery.contract.md
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
frontend/
├── src/
│   ├── components/
│   │   ├── ReleaseImageGallery.tsx        # root: lg:max-w-md cap; thumbnail column: min-h-0;
│   │   │                                  #   main <img> wrapped in a <button>; selectedIndex +
│   │   │                                  #   isFullscreenOpen state; renders GalleryFullscreenViewer
│   │   ├── GalleryFullscreenViewer.tsx    # new: edge-to-edge overlay (image + thumbnail strip + X),
│   │   │                                  #   backdrop-click/Escape/X close, no Card/max-width wrapper
│   │   └── ui/
│   │       ├── Modal.tsx                  # refactored: consumes shared CloseIcon + useEscapeKey
│   │       └── icons/
│   │           └── CloseIcon.tsx          # extracted from Modal.tsx, now shared
│   └── hooks/
│       └── useEscapeKey.ts                # extracted from Modal.tsx's inline keydown effect
├── tests/
│   └── unit/
│       ├── ReleaseImageGallery.test.tsx   # extended: sizing/scroll-cap + fullscreen open/close/nav
│       └── GalleryFullscreenViewer.test.tsx  # new
# No backend/ changes — pages (ReleaseDetailPage.tsx, RecordDetailPage.tsx,
# MasterReleaseDetailPage.tsx) are unchanged: same props, same testids
# (release-detail-gallery, record-detail-gallery, master-detail-gallery)

e2e/
└── tests/
    ├── release-detail.spec.ts             # extended: fullscreen open/close/navigate coverage
    └── *-responsive.spec.ts               # extended: contained-size + scroll-cap assertions per viewport
```

**Structure Decision**: No new top-level directories or projects. All
changes live inside the existing `frontend/` app: one new sibling component
(`GalleryFullscreenViewer.tsx`) next to the existing `ReleaseImageGallery`,
two small extractions out of the existing `Modal.tsx` (`CloseIcon`,
`useEscapeKey`) for reuse, and corresponding test additions. `backend/` is
untouched.

## Complexity Tracking

> Not applicable — Constitution Check reported no violations.
