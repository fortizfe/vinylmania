# Implementation Plan: Unified Record Detail Views

**Branch**: `063-record-detail-unification` | **Date**: 2026-09-07 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/063-record-detail-unification/spec.md`

## Summary

Make the record-detail experience identical across the three entry points (search,
My Library, wishlist): the same sections, in the same order, in the same `Card`, with
a consistent action bar under the back-link and one *My library*-only "Estado de mi
copia" card. Introduce a standalone **Rating card** that surfaces the personal rating
(extracted from `MyCopySection` / `WantlistPanel`) next to the Discogs community
rating and have/want counts (already present in the release payload, never shown on
the detail pages today).

Technical approach: this is a **frontend-only** refactor. No backend, no API, no data
model change — the `Release.community` object is already mapped by
`backend/src/adapters/discogsCatalog/discogsMapper.ts` and delivered on both the
catalog-release and library-entry payloads. Build a shared presentational layout
(`RecordDetailLayout`) plus small section components, then recompose the two existing
page components (`ReleaseDetailPage`, `RecordDetailPage`) on top of it. Desktop uses a
sticky media rail + scrolling liner-notes column; mobile is a single priority-ordered
column; the DOM order always follows the shared contract so assistive-tech traversal
matches it regardless of CSS placement.

> **Implementation note:** "sticky media rail" was reduced to a plain two-column
> "media-left" layout — a real sticky rail needs a contiguous DOM wrapper around the
> three left-column sections, which would break the mobile priority order and tab
> order (Principle X / FR-022). See spec Clarifications and research R3.

## Technical Context

**Language/Version**: TypeScript 5.x, React 19 (Vite)

**Primary Dependencies**: React 19, React Router, TanStack Query v5, Tailwind CSS v4,
clsx. Testing: Vitest + React Testing Library (frontend), Playwright (e2e).

**Storage**: N/A for this feature (no persistence change). Personal-rating writes
continue to go to the existing endpoints — `PATCH /api/library/:id` (`rating`) and
`PATCH /api/wantlist/:releaseId` (`rating`) — unchanged.

**Testing**: Vitest component tests (Red-Green-Refactor, Principle I) for every new /
changed component; Playwright e2e updates for the three affected flows (constitution
Development Workflow gate for `/frontend` changes).

**Target Platform**: Modern evergreen browsers; responsive from ~360px mobile to wide
desktop.

**Project Type**: Web application — `frontend/` React SPA + `backend/` Express API.
Only `frontend/` is touched.

**Performance Goals**: No new network requests on the detail views. No measurable
layout shift (CLS ≈ 0) between skeleton / empty / populated states for every section
(spec SC-008, FR-021).

**Constraints**: WCAG 2.1 AA hard gate (Principle X); Apple HIG via installed design
skills (Principle XI); Tailwind v4 CSS-first, `<Card>` for every content block, 44×44
touch targets, dark mode via theme tokens, dual purpose-built layouts (UI Design
System rules). `prefers-reduced-motion` respected for any rail/transition motion.

**Scale/Scope**: 2 route components recomposed; ~1 new layout component; 1 new Rating
card; 1 new action-bar component; 3 existing section components trimmed; 1 skeleton
reworked; ~6 e2e spec files updated. Master-release detail explicitly untouched
(FR-023).

### Resolved unknowns

| Question | Resolution |
|----------|------------|
| Does the detail payload carry the community rating + have/want? | **Yes.** `discogsMapper.mapRelease()` maps `community { have, want, rating { average, count } }` from Discogs `GET /releases/{id}`. `ReleaseDetailPage` (`useCatalogRelease`) and `RecordDetailPage` (`entry.release`) both already receive it. Zero backend work. |
| Converge the two page components into one? | **No.** They resolve different params (`:entryId` → `useLibraryEntry`; `:discogsId` → `useCatalogRelease` + `useWantlistEntry`) and different data shapes. Keep both routes; share a `RecordDetailLayout` and section components. (Spec Assumptions permit this.) |
| Sticky rail vs. flat DOM order | Resolved during implementation: **no sticky rail.** A contiguous sticky wrapper breaks the mobile priority order + tab order (Principle X / FR-022); per-item `lg:sticky` is a no-op (each slot is the tallest in its grid row) and its stacking context trapped the gallery's fullscreen `Overlay` under the header. Delivered as a plain `lg:` two-column grid (media-left / liner-notes-right), gallery component unchanged. See research R3. |
| `StreamingLinksSection` hard-codes `lg:col-span-2` + reserved height | Layout-only change (Principle: still "reused without functional change", FR-014): drop the hard-coded span so the parent places the card; keep the resolving-skeleton + collapse-to-null behavior. |

## Constitution Check

*GATE: must pass before Phase 0 and again after Phase 1 design.*

| Principle | Gate | Status |
|-----------|------|--------|
| I. Test-First (NON-NEGOTIABLE) | Every new/changed component gets a failing Vitest test first; e2e updated before the flow is considered done | **PASS (planned)** — task ordering in `/speckit-tasks` will enforce test-before-impl |
| II. Discogs Integration-First | No catalog metadata is hand-authored; community data comes from the existing Discogs adapter | **PASS** |
| III. Simplicity / YAGNI / KISS | One shared layout + small components; no config, no speculative variants; two pages kept rather than a speculative convergence | **PASS** |
| IV. SOLID | Section components are single-responsibility and presentational; pages own data-fetching; `RecordDetailLayout` owns arrangement only | **PASS** |
| V. Observability | No new server operations; frontend save-failure paths keep existing error surfacing (FR-007) | **PASS (N/A backend)** |
| VI. Versioning & Breaking Changes | No API/schema/stored-data change. Removing the wishlist notes field is a UI-only change; the Discogs wantlist note is not written or deleted (FR-016) | **PASS** — not a breaking change |
| VII. Curated Ratings (color-banded) | Community rating rendered via the existing color-banded `ReleaseRatingBadge`; personal via existing `StarRating` | **PASS** |
| VIII. Hexagonal Architecture (backend) | No `backend/` change | **PASS (N/A)** |
| IX. Frontend Network — Backend-Only | No new network calls; no external SDK; community data already served by our backend | **PASS** |
| X. Accessibility — WCAG 2.1 AA (NON-NEGOTIABLE) | Semantic `<section>` + one non-skipped heading per card; action bar controls have accessible names; DOM order = contract order; contrast via existing tokens; 44×44 targets; `prefers-reduced-motion` for rail/skeleton motion; no color-only rating state (numeric value + label alongside band) | **PASS (planned)** — verified by axe + keyboard walkthrough in quickstart |
| XI. Apple Design Principles | `apple-design` + `emil-design-eng` consulted before building; two-column media-left layout is a restraint-first spatial pattern; motion (if any) spring-based + interruptible + reduced-motion aware; typography/spacing stay on the project scale | **PASS (planned)** |
| UI Design System (Tailwind v4) | Every block is `<Card>`; CSS-first; `dark:` + tokens; skeleton mirrors final shape; no layout shift; dual layout via `lg:` breakpoint; no `tailwind.config.js` | **PASS (planned)** |
| Development Workflow — e2e for `/frontend` | `release-detail*.spec.ts`, `record-detail*.spec.ts` (+ responsive, inline-edit) updated to the new order and the new Rating card / action bar | **PASS (planned)** |
| Development Workflow — no manual CHANGELOG / version bump | Not touched | **PASS** |

**No violations. Complexity Tracking table not required.**

Post-Phase-1 re-check: see end of this file.

## Project Structure

### Documentation (this feature)

```text
specs/063-record-detail-unification/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output (view-model shapes; no persistence)
├── quickstart.md        # Phase 1 output (manual + automated validation guide)
├── contracts/
│   └── ui-contracts.md  # Phase 1 output (component props + layout/section contract)
├── checklists/
│   └── requirements.md  # Already present (spec quality checklist)
└── tasks.md             # Phase 2 output (/speckit-tasks — NOT created here)
```

### Source Code (repository root)

```text
frontend/src/
├── pages/
│   ├── ReleaseDetailPage.tsx        # RECOMPOSE — search + wishlist view onto RecordDetailLayout
│   ├── RecordDetailPage.tsx         # RECOMPOSE — library view onto RecordDetailLayout
│   └── MasterReleaseDetailPage.tsx  # UNTOUCHED (FR-023)
├── components/
│   ├── recordDetail/                # NEW folder — the shared detail surface
│   │   ├── RecordDetailLayout.tsx   # NEW — action-bar slot + rail/column responsive grid; fixes DOM order
│   │   ├── RecordDetailActions.tsx  # NEW — the consistent action bar (search / library / wishlist variants)
│   │   ├── RatingCard.tsx           # NEW — personal StarRating + community ReleaseRatingBadge + have/want
│   │   └── RecordDetailSkeleton.tsx # MOVED + REWORKED from components/RecordDetailSkeleton.tsx (mirror new layout)
│   ├── MyCopySection.tsx            # TRIM — remove the rating field (media/sleeve/notes + no Remove button)
│   ├── WantlistPanel.tsx            # DELETE — personal rating moves to RatingCard, notes retired (FR-016)
│   ├── ReleaseAdditionalInfoSection.tsx  # TRIM — remove the community "have/want · rating" line
│   ├── ReleaseDetailsSection.tsx    # UNTOUCHED (general-info content)
│   ├── ReleaseImageGallery.tsx      # UNTOUCHED
│   ├── ReleaseTracklistSection.tsx  # UNTOUCHED
│   └── StreamingLinksSection.tsx    # MINOR — drop hard-coded lg:col-span-2 so the parent places it
└── (tests colocated as *.test.tsx next to each component/page)

e2e/tests/
├── release-detail.spec.ts             # UPDATE — new section order, Rating card, action bar
├── release-detail-responsive.spec.ts  # UPDATE — rail (desktop) vs stack (mobile)
├── record-detail-inline-edit.spec.ts  # UPDATE — rating now edited in RatingCard; condition/notes in MyCopySection
├── record-detail-responsive.spec.ts   # UPDATE
├── wishlist-*.spec.ts                  # UPDATE where they assert the wishlist panel / notes field
└── (master-release-detail*.spec.ts     # UNTOUCHED)
```

**Structure Decision**: Web-application layout, `frontend/` only. A new
`frontend/src/components/recordDetail/` folder holds the shared surface so the three
views compose from one source of truth; the two route components stay as the
data-fetching entry points. `WantlistPanel` is deleted (rating → `RatingCard`, notes
retired). Backend untouched.

## Complexity Tracking

*No constitution violations — table intentionally omitted.*

## Phase 0 — Research

See [research.md](./research.md). All Technical Context unknowns are resolved there
(payload confirms community data; two-page structure kept; sticky-rail + tall-gallery
behavior; streaming-card placement + reflow trade-off; Apple-design guidance for the
rail).

## Phase 1 — Design & Contracts

- [data-model.md](./data-model.md) — the **view-model** shapes consumed by the shared
  components (no database entities; this feature persists nothing new). Documents how
  each view maps its data source onto `RatingCardModel`, `MyCopyModel`, and the
  action-bar variant.
- [contracts/ui-contracts.md](./contracts/ui-contracts.md) — props/behavior contract
  for `RecordDetailLayout`, `RecordDetailActions`, `RatingCard`, and the trimmed
  `MyCopySection` / `ReleaseAdditionalInfoSection`; the section-order contract; the
  DOM-order rule; the responsive/rail contract; accessibility contract.
- [quickstart.md](./quickstart.md) — how to validate end-to-end: the Vitest suites to
  run, the Playwright specs, and a manual keyboard + axe + reduced-motion walkthrough
  across all three views.

### Agent context update

The `update-agent-context` script is not present in this repo's
`.specify/scripts/bash/` (speckit 0.12.4) and there is no `CLAUDE.md` / `AGENTS.md`
to update — step skipped, no action required.

## Post-Phase-1 Constitution Re-Check

Re-evaluated after drafting `data-model.md` and `contracts/ui-contracts.md`: **still
no violations.** The design adds one layout component and three small presentational
components, deletes one (`WantlistPanel`), and trims two — net complexity is flat-to-
down. No new abstraction, no config surface, no backend change, no new network path.
Accessibility and Apple-design obligations are captured as explicit contract items and
as quickstart verification steps. Ready for `/speckit-tasks`.
