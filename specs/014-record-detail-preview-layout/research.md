# Phase 0 Research: Record Detail View Aligned with Preview Layout

All items in the Technical Context are already resolved from the existing codebase (this reuses components introduced by the release preview redesign, `013-release-preview-layout-redesign`), so no NEEDS CLARIFICATION markers remain. This document records the concrete decisions for the implementation-shaped questions the spec left to planning, plus one correction discovered while reconciling the spec against the existing code.

## 1. Single shared outer bordered surface

**Decision**: `RecordDetailPage` wraps its entire content area (gallery, key details, my copy, tracklist, remaining information) in one `<Card>`, the same way `Modal` wraps `ReleasePreviewModal`'s content in one `<Card>` today. None of the inner sections gets its own independent card border — including `MyCopySection`, per the spec's Clarifications answer.

**Rationale**: Confirmed by clarification. This is the closest structural match to "the same design as the preview" (User Story 1) while still satisfying the Constitution's card-based-layout rule: the page's one primary content block is that single `Card`.

**Alternatives considered**:
- Keeping today's per-block `Card`s (header image, disc info, my copy, tracklist each separately bordered) — rejected by the clarification; it would leave the page visually "boxier" than the preview and undercut the core ask.
- Single outer card with `MyCopySection` keeping its own inner card (to visually flag it as the one editable block) — considered and offered as an option, but not selected; the chosen answer keeps my copy visually consistent with the other cardless sections, relying on the existing hover/permanent editable-field affordance (already required by FR-005) to signal editability instead of a border.

## 2. Adding `format` to the shared key-details presentation

**Decision**: Extend `ReleaseDetailsSection` to also render the release's `formats` (e.g., "Vinyl (12\")") as `Badge`s, alongside the genres/styles/labels it already renders. This makes `format` part of the shared "key release details" set used by both the release preview and the record detail page.

**Rationale**: The current detail page (via the now-superseded `DiscInfoCard`) shows format today; the preview's `ReleaseDetailsSection` does not render it. Spec SC-005 requires that no previously-visible piece of information be lost by this redesign. Dropping format to match the preview's narrower field set as originally assumed would have violated SC-005 — so instead `format` is added to the shared component. This is a small, additive change (one more mapped array of `Badge`s, following the same pattern already used for genres/styles) rather than a new component or a forked field set between preview and detail page, and it improves the preview as a side effect (it gains a field it arguably should have had).

**Alternatives considered**:
- Drop `format` from the detail page to match the preview exactly, and treat the loss as accepted scope — rejected; contradicts SC-005 outright, and there's no other section (`ReleaseAdditionalInfoSection` covers notes/identifiers/community, not format) where the field could reasonably move instead.
- Render `format` only on the detail page via a small page-local addition, without touching the shared `ReleaseDetailsSection` — rejected; would immediately break the "identical structure" premise of User Story 1 (the preview and detail page would show visibly different key-details fields) and would duplicate the details-rendering logic between two components instead of one.

## 3. Extracting "my copy" into its own component

**Decision**: Extract the current inline "Your copy" JSX in `RecordDetailPage` (condition `InlineEditableField`, notes `InlineEditableField`, and the "Remove from library" button) into a new `MyCopySection` component, taking the entry's `condition`/`notes` plus `onSaveCondition`/`onSaveNotes`/`onRemove` callbacks as props. It renders as a plain (non-card) section, per Decision 1.

**Rationale**: Matches the existing pattern set by the preview's section components (`ReleaseDetailsSection`, `ReleaseTracklistSection`, `ReleaseAdditionalInfoSection`) — each layout section is its own single-purpose, independently testable component (Principle II). Keeping it inline in the page would leave `RecordDetailPage` mixing page-level data-fetching/mutation wiring with presentational markup for a section that, like the others, has exactly one reason to change (the my-copy display/edit behavior).

**Alternatives considered**: Leaving the "Your copy" block inline in `RecordDetailPage` as it is today, just moved to a new position — rejected; it would be the only one of the five layout sections not represented as its own component, breaking the consistency the rest of this feature establishes.

## 4. Deleting `DiscInfoCard`, `RecordHeaderImage`, `TracklistCard`

**Decision**: Delete these three components and their unit test files outright once `RecordDetailPage` is rewritten to use `ReleaseDetailsSection`, `ReleaseImageGallery`, and `ReleaseTracklistSection` instead.

**Rationale**: Once superseded, they have no remaining callers (each was only ever used by `RecordDetailPage`). Leaving them in the tree would be dead code, violating Principle III (no code that exists purely for organizational convenience) and inviting future drift between two parallel "detail" and "preview" presentations of the same data — exactly the inconsistency this feature exists to remove.

**Alternatives considered**: Keeping them "just in case" for a future reversion — rejected; git history is the correct rollback mechanism, not dead code left in the working tree.

## 5. Loading-state skeleton shape

**Decision**: Reshape `RecordDetailSkeleton` to mirror the new layout inside a single `Card`: a full-width square skeleton (gallery), a two-column skeleton row (key details + my-copy skeleton on the left, tracklist skeleton on the right), and a full-width skeleton block (remaining info) — reusing the existing `<Skeleton>` primitive, no new loading component.

**Rationale**: Directly required by the Constitution's "no layout shift" / "skeleton mirrors final content shape" rules, and mirrors how `ReleasePreviewModal`'s own loading branch is already shaped for the same reason.

**Alternatives considered**: A generic spinner or blank state — explicitly disallowed by the Constitution's Skeleton loading states rule.

## 6. Breakpoint reuse

**Decision**: Reuse the existing `lg:` (1024px) Tailwind breakpoint already used by `ReleasePreviewModal`'s `grid grid-cols-1 lg:grid-cols-2` for the detail page's stacked-vs-two-column switch.

**Rationale**: Keeps the preview and detail page changing layout at the same viewport width, reinforcing the "same design" goal (User Story 1) and avoiding a second, inconsistent breakpoint convention.

**Alternatives considered**: A dedicated, possibly different breakpoint for the detail page — rejected; no requirement calls for a different transition point, and introducing one would only create a visible inconsistency between the two screens on tablet-width viewports.

## 7. Test and coverage strategy

**Decision**: Update `frontend/tests/integration/recordDetailFlow.test.tsx` to assert the new structure (single outer card, format badges present, my-copy positioned directly under key details, additional-info section rendered when data is present, unchanged inline-edit behavior); add a new `MyCopySection.test.tsx` unit test; update `ReleaseDetailsSection.test.tsx` to cover the new `format` rendering (and its degrade-gracefully case when `formats` is empty); delete `DiscInfoCard.test.tsx`, `RecordHeaderImage.test.tsx`, `TracklistCard.test.tsx`; extend `e2e/tests/record-detail-inline-edit.spec.ts` (or add a sibling spec) to assert the redesigned layout renders and that the existing inline-edit e2e flow (condition autosave surviving reload) still passes unchanged.

**Rationale**: Satisfies Principle I (Test-First) and the Development Workflow gate requiring e2e coverage for any `frontend` change touching a user flow. The existing e2e spec's inline-edit assertions must keep passing unmodified in behavior (only the surrounding markup they locate elements within changes), which is the strongest signal that FR-005 (no regression to inline-edit behavior) holds in a real browser.

**Alternatives considered**: Relying on unit/component tests alone for the layout/structure requirements — rejected; the Constitution forbids merging frontend changes on unit coverage alone when a user flow is affected, and the existing e2e spec already exercises the exact flow (`/app/library/records/:entryId`, inline condition edit, reload persistence) this feature must not regress.
