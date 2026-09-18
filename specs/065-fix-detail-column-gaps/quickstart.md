# Quickstart: Validating the two-column detail layout fix

## Prerequisites

- `frontend/` dependencies installed (`npm install` in `frontend/`).
- Dev server running: `npm run dev` in `frontend/` (proxies `/api` to a local backend per `vite.config.ts`, or point `VITE_BACKEND_ORIGIN` elsewhere).
- Signed in as a fake Google user (dev/e2e auth stub) to reach an authenticated release/library page.

## Manual repro (before the fix)

1. Open a release detail page (`/app/releases/:discogsId`) for a release with a short tracklist and a long "other details"/notes block, or vice versa, at a desktop viewport width (≥ 1024px).
2. Observe an empty gap in one column, roughly the height of a card in the other column, between two cards that should be flush.
3. Repeat on a library record detail page (`/app/library/:entryId`) and a master release page (`/app/masters/:discogsId`) with similarly mismatched card content lengths.

## Automated validation

```bash
# Unit / integration (Vitest + RTL) — hook contract + component behavior
cd frontend && npm test -- useIndependentColumnLayout RecordDetailLayout RecordDetailSkeleton MasterReleaseDetailPage

# Type-check and lint
cd frontend && npm run build   # tsc -b && vite build
cd frontend && npm run lint

# End-to-end (Playwright), the three affected pages' responsive specs
cd e2e && npx playwright test release-detail-responsive record-detail-responsive master-release-detail-responsive
```

## Expected outcome

- No visible gap between cards in either column, on any of the three pages, at any desktop viewport width ≥ 1024px, regardless of which card is taller (see `spec.md` SC-001/SC-002).
- The loading skeleton for each page shows the same independently stacked, gap-free columns as the loaded content, with no layout shift on the skeleton→content swap (SC-005).
- Tabbing through any of the three pages visits interactive elements in the exact same order as before the fix (User Story 3 / FR-005).
- The single-column mobile/tablet layout (< 1024px) is visually and structurally unchanged (FR-006) — verify by comparing a viewport screenshot at 375px width before and after.

## Cross-reference

- Root cause and rejected alternatives: `research.md`.
- Hook interface and test expectations: `contracts/useIndependentColumnLayout.contract.md`.
- Full requirements: `spec.md`.
