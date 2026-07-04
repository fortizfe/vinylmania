# Implementation Plan: Release Preview Popup — Full Details & Image Gallery

**Branch**: `012-release-preview-gallery` | **Date**: 2026-07-04 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/012-release-preview-gallery/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command. See `.specify/templates/plan-template.md` for the execution workflow.

## Summary

Extend the shared `Release` model (backend `discogs/types.ts` + zod mapper,
mirrored 1:1 in frontend `services/libraryApi.ts`) with the additional
Discogs release fields the spec calls for — full release date, notes,
identifiers, and community statistics — then redesign
`ReleasePreviewModal.tsx` to show a details section built from all of it
(existing + new fields) above the tracklist, in a layout that is two columns
(image gallery | details + tracklist) at the same `lg:` breakpoint the record
detail page (010) already uses, collapsing to one stacked column below it.
The current single static cover image is replaced with a small new
`ReleaseImageGallery` component (primary image + vertical clickable
thumbnails) built from the `images[]` array the backend already returns in
full — no new Discogs call or image-fetching logic needed there. Because
`Release` is already shared verbatim between the preview popup, the record
detail page, and `EnrichedLibraryEntry`, widening it also satisfies FR-011
(detail view's data model gains the same fields) without any detail-view
code change in this feature.

## Technical Context

**Language/Version**: TypeScript throughout — Node.js/Express backend
(`backend/`, existing), React 19 frontend (`frontend/`, existing). No version
change.

**Primary Dependencies**: Backend — `axios` (Discogs HTTP client, existing),
`zod` (response validation, existing). Frontend — `react`, `react-router-dom`,
`tailwindcss` v4, `clsx` (all existing). No new dependency is introduced: the
vertical thumbnail gallery is plain click-to-select state (no swipe/drag
requirement in the spec), so no carousel/slider library is added.

**Storage**: N/A for persistence (Firestore is untouched — this feature adds
no new persisted fields to `EnrichedLibraryEntry`). Redis remains a
cache-aside performance cache for Discogs `Release` responses
(`discogs:release:{id}`, 6h TTL, per `backend/src/discogs/discogsClient.ts`);
see research.md for how already-cached entries behave across this change.

**Testing**: Jest for backend unit (`backend/tests/unit/discogsMapper.test.ts`)
and contract tests (`backend/tests/contract/discogsRelease.contract.test.ts`);
Vitest + React Testing Library for frontend component tests
(`frontend/tests/unit/ReleasePreviewModal.test.tsx` and a new gallery
component test); Playwright for e2e (`e2e/tests/`), required by the
constitution's e2e quality gate for this `/frontend` change.

**Target Platform**: Web (responsive: phone through desktop viewport
widths), existing React SPA served by Vite/Vercel; existing Express API on
its current host.

**Project Type**: Web application (existing `backend/` + `frontend/` split).
This feature touches both: `backend/` for the widened `Release` model/mapper,
`frontend/` for the popup redesign.

**Performance Goals**: No new performance target. The popup must keep
today's perceived load time — one `getRelease` call per open, same skeleton
while it resolves; the extra fields ride along in the same Discogs response
already being fetched, so no additional round trip is introduced.

**Constraints**: Layout switch MUST be driven purely by CSS responsive
breakpoints (no user-agent/device-type branching), consistent with 010's
precedent. MUST NOT increase the number of Discogs API calls per popup open.
MUST NOT introduce a new UI dependency for the gallery. Already-cached
`Release` entries in Redis MAY lack the new fields for up to the existing 6h
TTL after deploy (see research.md — accepted, not treated as a migration).

**Scale/Scope**: Widen one shared type (`Release`) and its zod schema in two
mirrored files; redesign one existing component
(`ReleasePreviewModal.tsx`); add two small new presentational components
(`ReleaseImageGallery`, and a details-list component for the new/point-in-time
unused fields); widen the shared `Modal` component with an opt-in larger size
so this popup can fit two columns without affecting its other caller
(`HamburgerMenu`'s `end`-positioned drawer). No new routes; no new backend
endpoints (existing `GET /api/discogs/releases/:discogsId` gains fields, not
a new shape).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **Principle I (Test-First)**: Mapper unit tests (new raw Discogs fields →
  `Release` fields, including omission when absent) and a contract test
  update MUST be written before extending `discogsMapper.ts`. Frontend
  component tests for the new gallery component (thumbnail click swaps
  primary image; single/zero-image edge cases) and the expanded
  `ReleasePreviewModal` (new details section renders only present fields;
  two-column vs. stacked rendering) MUST be written before implementation.
  PASS (planned; enforced in tasks.md).
- **Principle II (Library-First & Modularity)**: The image gallery and the
  new details section MUST each be their own presentational component
  (`ReleaseImageGallery`, details-list component), taking `release`/`images`
  via props only — independently testable, and reusable later by the record
  detail page redesign without duplicating this popup's logic. PASS.
- **Principle III (Simplicity, YAGNI & KISS)**: No carousel/swiper
  dependency; no speculative Discogs fields beyond the list fixed in the
  spec's Assumptions (notes, full release date, identifiers, community
  stats) — videos/companies/series are explicitly out of scope. Cache
  staleness after deploy is accepted rather than solved with cache-key
  versioning (see research.md). PASS.
- **Principle IV (SOLID)**: New components depend only on the `Release`
  shape via props (no fetch/query coupling), so they can be reused by a
  future detail-view redesign (FR-011) without modification. The shared
  `Modal` gains an additive size option rather than a second modal
  implementation. PASS.
- **Principle V (Observability)**: Zod parse failures for the new optional
  fields flow through the existing `DiscogsValidationError` path (already
  logged) — no new error path is introduced beyond what the current
  `getRelease`/mapper error handling already covers. PASS.
- **Principle VI (Versioning & Breaking Changes)**: All new `Release` fields
  are additive and optional; the `GET /api/discogs/releases/:discogsId`
  response shape is extended, not changed incompatibly → MINOR on both
  packages once released. No migration needed (Firestore/persisted data
  untouched). PASS.
- **UI Design System (Tailwind v4)**: New components MUST use the existing
  `Card`/`Badge`/`Skeleton` primitives (no ad-hoc styling), MUST add a
  skeleton shape matching the new two-column/gallery layout, MUST support
  dark mode via `dark:` + existing `@theme` variables, MUST NOT cause layout
  shift between skeleton/populated states, and MUST NOT introduce custom CSS
  or a `tailwind.config.js`. PASS (planned).
- **Development Workflow — e2e quality gate**: This PR changes `/frontend`,
  so Playwright coverage under `/e2e` MUST be added/updated for opening the
  preview popup, seeing the expanded details section, and clicking a
  thumbnail to change the primary image, before the feature is complete.
  PASS (planned in tasks; no existing e2e spec covers the preview popup
  today, so this is a new spec file, not an edit).
- **Development Workflow — CHANGELOG gate**: This PR touches both `/backend`
  (mapper/schema) and `/frontend` (popup) → both `backend/CHANGELOG.md` and
  `frontend/CHANGELOG.md` need a new dated entry and a matching MINOR
  version bump in their respective `package.json`. PASS (planned).
- **Technology Stack**: No deviation — stays within
  React/TypeScript/Tailwind v4/Express/zod/Redis on the existing
  `backend/`/`frontend/` packages, and vinyl metadata continues to be
  sourced exclusively from Discogs (no hand-authored catalog data). PASS.

## Project Structure

### Documentation (this feature)

```text
specs/012-release-preview-gallery/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md         # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/           # Phase 1 output (/speckit-plan command)
│   └── discogs-release-api.md
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
backend/
├── src/
│   ├── discogs/
│   │   ├── types.ts           # Release/CatalogImage/etc. — widen Release with
│   │   │                       # new fields (releaseDate, notes, identifiers,
│   │   │                       # community)
│   │   └── discogsMapper.ts   # rawReleaseSchema + mapRelease — parse the new
│   │                           # raw Discogs fields
│   └── routes/discogs.ts       # GET /releases/:discogsId — unchanged handler,
│                                # response shape grows via mapRelease
└── tests/
    ├── unit/discogsMapper.test.ts               # new field mapping cases
    └── contract/discogsRelease.contract.test.ts # updated response contract

frontend/
├── src/
│   ├── services/libraryApi.ts        # Release/CatalogImage types mirrored
│   │                                  # 1:1 with backend/src/discogs/types.ts
│   ├── components/
│   │   ├── ReleasePreviewModal.tsx   # redesigned: two-column layout, renders
│   │   │                              # gallery + details section + tracklist
│   │   ├── ReleaseImageGallery.tsx   # NEW — primary image + vertical
│   │   │                              # clickable thumbnails
│   │   ├── ReleaseDetailsSection.tsx # NEW — renders the "before tracklist"
│   │   │                              # supplemental details, field-by-field,
│   │   │                              # omitting absent ones
│   │   └── ui/Modal.tsx              # add an additive `size` option so this
│   │                                  # popup can use a wider dialog than the
│   │                                  # `end`-drawer caller (HamburgerMenu)
│   └── pages/AddRecordPage.tsx       # wires ReleasePreviewModal — no change
│                                       # expected beyond passing the same
│                                       # `release`/`loading` props
└── tests/
    └── unit/ReleasePreviewModal.test.tsx  # extended; plus a new
                                             # ReleaseImageGallery test

e2e/
└── tests/
    └── release-preview-gallery.spec.ts    # NEW — open popup from search,
                                             # verify details + gallery browsing
```

**Structure Decision**: Existing web application split (`backend/` +
`frontend/` + `e2e/`) is unchanged. This feature is additive within that
structure: one widened shared type, one redesigned component, two new small
presentational components, one additive prop on the shared `Modal`, and one
new e2e spec. No new top-level directories or projects.

## Complexity Tracking

*No constitution violations requiring justification — table intentionally
left empty.*
