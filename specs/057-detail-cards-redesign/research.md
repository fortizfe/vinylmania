# Research: Detail Screens Card-Based Redesign

No open `NEEDS CLARIFICATION` markers remain in the Technical Context — this is a frontend-only presentational restructuring of already-fetched data, using only the existing stack (React/TypeScript, Tailwind v4, existing `Card`/`Badge`/`Button` components). The decisions below resolve implementation-level questions the spec intentionally left as design/implementation detail (see spec Assumptions), plus one small new UI element approved during clarification.

## Decision 1: Card visual weight and inter-card spacing values

**Decision**: Reuse the existing `Card` component (`frontend/src/components/ui/Card.tsx`) unchanged — `rounded-xl border border-stone-200 bg-stone-50 shadow-sm` (light) / `dark:border-border-dark dark:bg-surface-raised` (dark), with `padding="sm"` (`p-4`) for most cards on these screens instead of the default `padding="md"` (`p-6`), since `sm` already reads as less "marked" while remaining within the constitution's sanctioned padding scale (`p-4` or `p-6`). Reduce the **gap between sibling cards** on each page from the current `gap-6` (used for the single outer card's internal grid) to a flat `gap-4` at all viewport widths — still the constitution's own cited example of "generous" spacing (`gap-4`), just applied between cards instead of within one, so no interpretation of that rule is needed at all.

**Rationale**: The constitution's "Card-based layout" and "Visual lightness" rules already sanction `shadow-sm` as the lightest allowed elevation and `border-stone-200` as the standard border — there's no lighter *sanctioned* variant to introduce, so achieving "not too marked" is a matter of using the lightest end of the existing scale (small padding, `shadow-sm`, thin border) rather than adding a new card variant. Tightening the *gap* (not the *padding*) is the correct lever for "poca separación." An earlier version of this decision used `gap-3` on mobile, reasoning that "generous" only governed non-token/arbitrary spacing rather than setting a hard per-gap floor — `/speckit-analyze` flagged that as a self-reinterpretation of a constitution MUST (the rule names `gap-4` explicitly), so the value was raised to `gap-4` everywhere to remove the ambiguity entirely: `gap-4` is still a full two steps tighter than the pages' current `gap-6`, which comfortably satisfies "poca separación," while matching the constitution's own example value instead of arguing around it.

**Alternatives considered**:
- New "flat"/borderless Card variant (no border, no shadow) — rejected: goes beyond what the constitution's Card-based layout rule sanctions (which requires `border` + `shadow-sm`/`shadow-md`) and would need a documented Complexity Tracking justification for no real benefit, since `shadow-sm` + thin `border-stone-200` already reads as subtle.
- Custom arbitrary gap value (e.g. `gap-[10px]`) — rejected: violates "No custom CSS without justification"; a scale token (`gap-4`) achieves the same visual intent.
- `gap-3` on mobile / `gap-4` on `lg:` — rejected on `/speckit-analyze` review (finding C1): sits below the constitution's own cited "generous" example without an explicit Complexity Tracking justification; `gap-4` at all widths removes the tension.

## Decision 2: Test update strategy (unit, integration, e2e)

**Decision**: Update `data-testid` attributes on each page to match the new per-card structure (e.g. replace the single `record-detail-content` wrapper's children test IDs with one per card: `record-detail-gallery-card`, `record-detail-main-info-card`, `record-detail-your-copy-card`, `record-detail-tracklist-card`, `record-detail-other-details-card`, and the master/release equivalents), then update the existing unit tests (`frontend/tests/unit/ReleaseDetailPage.test.tsx`, `frontend/tests/unit/MasterReleaseDetailPage.test.tsx`), the integration test (`frontend/tests/integration/recordDetailFlow.test.tsx`), and the e2e specs (`e2e/tests/record-detail-inline-edit.spec.ts`, `record-detail-responsive.spec.ts`, `release-detail.spec.ts`, `release-detail-responsive.spec.ts`, `master-release-detail-responsive.spec.ts`) to locate content via the new test IDs/roles. No test logic beyond locator updates should change, since underlying behavior (FR-012) is unchanged.

**Rationale**: Per constitution Principle I (Test-First) and the mandatory e2e-on-frontend-PR workflow rule, these tests are the enforcement mechanism for "no functional regression" (spec SC-002) and must stay green through the restructuring rather than being weakened or deleted.

**Alternatives considered**: Leaving old testids on invisible wrapper elements purely to avoid touching tests — rejected: constitution explicitly forbids unjustified complexity (Principle III), and dead wrapper elements kept only for test compatibility are exactly that.

## Decision 3: "View on Discogs" link (master release "other details" card)

**Decision**: Add a plain text link using the existing external-link convention already established in `FeedArticleCard.tsx` (`target="_blank" rel="noopener noreferrer"`), styled with the design system's primary accent color for interactive text, placed as the last item in the master release "other details" card, using the already-fetched `master.discogsUrl` field (present on the `MasterRelease` type but currently unused in the UI).

**Rationale**: Spec Clarification Q3 approved this addition; reusing the existing external-link pattern avoids introducing a new interaction convention, and the field is already fetched so no backend/API change is needed.

**Alternatives considered**: Icon-only external-link button — rejected as unnecessary scope beyond what was approved (a simple text link satisfies the requirement with the least new UI surface).

## Decision 4: `MasterVersionsTable` mobile per-row cards

**Decision**: Apply the same lighter `padding="sm"` / tightened-gap treatment used for the page-level cards to the existing per-row `Card` elements in `MasterVersionsTable`'s mobile layout, for visual consistency with the rest of the redesigned page. No change to the table's pagination logic, data fetching, or desktop `<table>` rendering.

**Rationale**: Spec Assumptions explicitly call for this consistency pass; it's a styling-only touch to an already-existing `Card` usage, not new functionality.

**Alternatives considered**: Leaving the versions-table mobile cards at their current styling — rejected: would leave one visibly heavier card style inside an otherwise lightened page, undermining SC-005's "matches the intended subtle, lightly separated look" outcome.
