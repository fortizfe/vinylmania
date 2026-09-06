# Feature Specification: Apple HIG Component Polish

**Feature Branch**: `059-apple-hig-component-polish`

**Created**: 2026-09-05

**Status**: Draft

**Input**: User description: "Quiero que, bajo las nuevas premisas de diseño basado en los principios de apple que hemos añadido a la constitution y usando las nuevas skills de apple que tenemos instaladas en claude, analices a fondo los componentes que disponemos actualmente y diseñes un plan de mejora para todos ellos. IMPRESCINDIBLE aplicar los principios de human interface de apple (https://developer.apple.com/design/human-interface-guidelines/design-principles)"

## Overview

Vinylmania's shared component library was recently hardened for accessibility (WCAG 2.1 AA, spec 058) and given a warm-neutral brand personality. It is functionally solid but interaction-flat: controls give feedback only on release, transitions use constant-speed CSS easing, overlays appear and vanish without depth or continuity, touch users cannot dismiss sheets or browse the gallery by gesture, and motion ignores the user's reduced-motion preference.

This feature is a **deep audit of every existing UI component plus a prioritized improvement plan** that brings the whole component library up to the design principles of Apple's Human Interface Guidelines — consistency, clarity and restraint, feedback, direct manipulation, spatial consistency, physically believable and interruptible motion, appropriate depth and materials, and disciplined typography — as now required by Constitution Principle XI. The existing WCAG 2.1 AA conformance (Principle X) and the Tailwind "UI Design System & Styling" rules are the floor: nothing in this feature may regress them, and where Apple's guidance would conflict, those rules win.

## Clarifications

### Session 2026-09-05

- Q: What implementation approach is acceptable for physically-believable motion and 1:1 drag gestures? → A: Allow one focused motion/gesture library (springs + drag), used via a shared wrapper; CSS handles trivial state transitions.
- Q: What concrete performance bar should motion be held to? → A: Sustained 60 fps during transitions on a mid-tier device (≈4× CPU throttle / low-tier mobile profile), with a ~16 ms frame budget; degrade to a simpler transition when exceeded.
- Q: Where should the component audit deliverable (FR-016) be recorded? → A: A standalone `audit.md` in the feature directory, one row per component, produced during planning and referenced by tasks.
- Q: What triggers drag-to-dismiss on release for a sheet/drawer? → A: Dragged past ~40–50% of the sheet's size OR released with outward velocity above a threshold; otherwise spring back.

## Scope

**In scope** — every reusable component under `frontend/src/components/`:

- **Atomic (`ui/`)**: `Button` (+ `buttonClassName`/`iconButtonClassName`), `Card`, `Modal`, `Input`, `Checkbox`, `Badge`, `Avatar`, `Skeleton`, `BackLink`, `StarRating`, `ThemeToggle`, `ViewModeToggle`, `ReleaseRatingBadge`, `InlineEditableField`, `icons/CloseIcon`.
- **Composite**: `AppHeader`, `LandingHeader`, `HamburgerMenu`, `HeaderNavIcons`, `HeaderSearchBox`, `GalleryFullscreenViewer`, `ReleaseImageGallery`, `RecordCard`, `RecordCardSkeleton`, `RecordListRow`, `RecordListRowSkeleton`, `SearchResultCard`, `SearchResultListRow` (+ skeletons), `ResultCardActions`, `SearchResultCardSkeleton`, `FeedArticleBoard`, `FeedArticleCard` (+ skeleton), `FeedCategoryFilterBar`, `FeedSourceFilterBar`, `FeedSourceStatusBanner`, `DiscogsConnectionCard` (+ skeleton), `DiscogsRelinkNotice`, `LibraryLinkRequired`, `MasterReleaseDetailsSection`, `MasterReleaseOtherDetailsSection`, `MasterVersionsTable` (+ skeleton), `MyCopySection`, `ReleaseDetailsSection`, `ReleaseAdditionalInfoSection`, `ReleaseTracklistSection`, `RecordDetailSkeleton`, `LandingHero`, `LandingPillarSection`, `GoogleSignInButton`, `DiscogsConnectionCard`, `UnderConstruction`, `filters/CollapsibleFilterPanel`, `filters/SelectableListFilter`, `filters/FilterActions`, `FiltersControl`, `HamburgerMenu`.
- **Brand (`brand/`)**: `VinylmaniaIcon`, `VinylmaniaWordmark`, `VinylmaniaGrungeFilter` — reviewed for motion/appearance only.
- The shared theme surface in `frontend/src/styles/global.css` (motion tokens, elevation tokens) as needed to support the above.

**Out of scope**:

- Page-level layout redesigns or information-architecture changes (the dual desktop/mobile layouts stay as they are; this is interaction, motion, depth, and typography polish, not re-layout).
- Any change to the brand palette, the display typeface choice, or the Tailwind design-system rules in the constitution.
- Backend, `e2e/` infrastructure (e2e *coverage* for affected flows is required output, not a scope exclusion), and non-UI code.
- New product features or new screens.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Controls respond the instant they are touched (Priority: P1)

A collector taps a button, a filter chip, a star rating, a theme switch, or a nav icon. The control acknowledges the press immediately — before the finger lifts — with a brief, physical-feeling depression, so the interface feels directly connected to their touch rather than laggy or uncertain.

**Why this priority**: "Response — kill latency" is the foundation of the Apple HIG feel; every other improvement builds on it. It touches the largest number of components, is the most noticeable single change, and is independently shippable without any of the other stories.

**Independent Test**: With only this story implemented, exercise every interactive control by pointer and by keyboard; confirm each shows a distinct pressed state within ~100 ms of pointer-down (not on release), visually separate from its hover and focus states, and that keyboard activation still produces an equivalent acknowledgement. WCAG scans still pass.

**Acceptance Scenarios**:

1. **Given** any button, icon button, filter chip, star, toggle, or inline-edit trigger, **When** the user presses it, **Then** a pressed/active visual state appears within ~100 ms of pointer-down and reverts on release or cancel.
2. **Given** a control with hover, focus, and pressed states, **When** each state is triggered, **Then** all three are visually distinguishable from each other and from the resting state.
3. **Given** a user pressing a control then dragging their finger off it before releasing, **When** the pointer leaves the control, **Then** the pressed state is cancelled and no action fires.
4. **Given** a keyboard-only user, **When** they activate a control with Enter/Space, **Then** they get an equivalent brief acknowledgement and the focus ring remains visible and AA-compliant.

---

### User Story 2 - Transitions feel physical and can be interrupted (Priority: P1)

When an overlay opens or closes, a panel expands, a toggle flips, or a view swaps, the motion decelerates naturally like a real object settling, and the user can reverse or grab it mid-flight without waiting for it to finish or seeing a visual jump. Users who prefer reduced motion get a plain, quick cross-fade with no movement.

**Why this priority**: Interruptibility is described in the HIG material as "the single most important principle," and unmotivated linear transitions are the most visible current gap. Ships independently of gestures (Story 4) and depth (Story 3).

**Independent Test**: Trigger the modal, the end-drawer (hamburger menu), the collapsible filter panel, the theme/view toggles, and the gallery viewer; confirm open/close motion decelerates rather than moving at constant speed, that re-triggering mid-transition continues smoothly from the current on-screen position, and that enabling `prefers-reduced-motion` removes all positional/scale movement leaving only a short opacity change.

**Acceptance Scenarios**:

1. **Given** any component that animates a transition, **When** it plays, **Then** the motion uses natural deceleration (spring-like settling) rather than constant-speed easing.
2. **Given** a transition in progress, **When** the user triggers the opposite action, **Then** the animation reverses from its current on-screen state with no jump to a start/end value and without input being locked out.
3. **Given** a user with `prefers-reduced-motion: reduce`, **When** any transition occurs, **Then** no element translates, scales, or springs; only a brief opacity change (or an instant swap) is used, and skeleton loaders do not pulse.
4. **Given** all animated components, **When** their motion is inspected, **Then** every duration and easing curve comes from one shared set of motion tokens, not per-component ad hoc values.

---

### User Story 3 - Overlays have depth and keep you oriented (Priority: P2)

When a modal, drawer, or the fullscreen gallery opens, the layer above is clearly distinguished from the content beneath by a material treatment (a dimmed, softly blurred backdrop) so the user understands they are in a temporary layer and can see where they will return to. Focus is managed so keyboard and screen-reader users are held inside the overlay and returned to their place on close.

**Why this priority**: Depth/materials and spatial consistency make overlays legible; correct focus management is also a latent WCAG gap in the current `Modal`. Valuable on its own, but less universally felt than Stories 1–2.

**Independent Test**: Open each overlay; confirm the backdrop dims and blurs the underlying page while overlay content still meets AA contrast; Tab stays within the overlay; Escape and backdrop-tap close it; and focus returns to the control that opened it. Background scrolling is locked while open.

**Acceptance Scenarios**:

1. **Given** a modal, end-drawer, or fullscreen gallery, **When** it opens, **Then** the underlying content is dimmed and softly blurred, and the overlay surface reads as floating above it (elevation consistent with the design system's shadow scale for floating elements).
2. **Given** an open overlay, **When** a keyboard user presses Tab/Shift+Tab, **Then** focus cycles only through the overlay's focusable elements and never reaches the background.
3. **Given** an overlay opened from a trigger control, **When** it closes by any means (button, Escape, backdrop, gesture), **Then** focus returns to that trigger control.
4. **Given** an open overlay, **When** the user attempts to scroll, **Then** the background page does not scroll; only overflowing overlay content scrolls.
5. **Given** overlay content over a blurred backdrop showing busy cover art, **When** contrast is measured, **Then** all overlay text and controls still meet WCAG 2.1 AA.

---

### User Story 4 - Touch users can drive sheets and the gallery by gesture (Priority: P2)

On a phone, the collector swipes the side menu / any bottom-or-side sheet away with their finger and it tracks 1:1, springing shut if they flick it far or fast enough and springing back if they don't. In the fullscreen gallery they swipe left/right to move between images. Every gesture has an equivalent button and keyboard path.

**Why this priority**: Direct manipulation is core to the HIG feel and the app is mobile-first, but it affects fewer components than Stories 1–2 and depends on Story 2's motion tokens being in place.

**Independent Test**: On a touch viewport, drag the end-drawer and a sheet: confirm the surface follows the finger with the correct grab offset, dismisses on a sufficient distance/velocity, and springs back otherwise. In the gallery, swipe between images. Verify buttons and keyboard still perform all the same actions.

**Acceptance Scenarios**:

1. **Given** a dismissible sheet/drawer on a touch device, **When** the user drags it, **Then** it tracks the pointer 1:1 from the grab point for the whole drag, not just at the end.
2. **Given** a partially dragged sheet, **When** the user releases having moved it less than ~40–50% of its size and without a fast outward flick, **Then** it springs back to fully open; **When** released past ~40–50% of its size or with outward velocity above the threshold, **Then** it springs closed and fires its close handler.
3. **Given** the fullscreen gallery with multiple images on a touch device, **When** the user swipes horizontally, **Then** the image advances to the next/previous one with natural settling, and the thumbnail selection stays in sync.
4. **Given** any gesture-driven behavior, **When** a keyboard-only or non-touch user needs the same result, **Then** an equivalent visible control and key binding exists.
5. **Given** a scrollable sheet, **When** the user's drag begins on scrollable content that is not at its scroll boundary, **Then** the drag scrolls the content rather than dismissing the sheet.

---

### User Story 5 - One consistent interaction and type language across every component (Priority: P2)

Across the whole app, the same concept looks and behaves the same way: selection toggles share one pattern, dismissal shares one pattern, expand/collapse shares one pattern, and large/display text is set with consistent tracking and leading while body hierarchy is carried by weight, size, and color rather than decoration or underlines-as-emphasis. A collector never has to relearn a control because a different screen implemented it differently.

**Why this priority**: Consistency and typographic discipline are HIG principles in their own right and the audit is likely to surface several one-off patterns (three different toggle idioms, ad-hoc underlined links, mixed focus treatments). Lower priority only because it is refinement rather than a capability gap.

**Independent Test**: Produce the component audit; confirm each shared interaction concept resolves to exactly one documented pattern, that all instances conform, and that a typography pass defines tracking/leading for display text and removes decoration-as-emphasis from body text — with no AA regression.

**Acceptance Scenarios**:

1. **Given** all selection/toggle controls (theme switch, view-mode toggle, star rating, filter chips, checkboxes), **When** they are compared, **Then** each maps to one documented interaction pattern appropriate to its semantics, with a single shared focus-indicator treatment.
2. **Given** all dismissible surfaces and all expand/collapse controls, **When** compared, **Then** each group uses one consistent motion, affordance, and iconography.
3. **Given** display/large text (page headers, pillar headers, showcase titles) and body text, **When** inspected, **Then** display text has deliberate tracking and line-height tokens and body hierarchy relies on weight/size/color, not underline or all-caps as emphasis (brand wordmark excepted).
4. **Given** the full component set, **When** the audit is reviewed, **Then** every component has a disposition of "conforms", "refine", or "rework" with the specific HIG principle(s) at stake and the design-skill guidance consulted.

---

### Edge Cases

- **Reduced motion + gesture**: a user with `prefers-reduced-motion` still needs drag-to-dismiss; the drag tracks 1:1 but the settle/spring is replaced with an instant or near-instant snap.
- **Low-end device / heavy page**: motion must stay smooth or degrade gracefully (drop to a simpler transition) rather than jank; a dropped frame budget must not block input.
- **Abandoned gesture**: a drag that starts and is released almost immediately, or a multi-touch/again-grabbed surface mid-animation, must resolve to a valid state (open or closed), never a stuck partial state.
- **Nested overlays**: opening a confirm dialog from within a modal must keep focus trapping and restore correct focus on unwind.
- **Backdrop blur unsupported**: on browsers without backdrop-filter support, the backdrop falls back to a solid/stronger dim that still meets contrast and still reads as a distinct layer.
- **Very long modal content**: drag-to-dismiss must not fight the internal scroll; the dismiss gesture only engages from the scroll boundary or from a non-scrolling grab handle/header.
- **Keyboard-only + touch-only parity**: no action may be reachable by only one input modality.
- **Pressed state on disabled/loading controls**: a disabled or `aria-busy` control must not show a pressed state or fire on press.
- **RTL / long localized labels**: pressed/motion treatments must not assume text length or left-to-right layout (LTR is the current baseline but treatments should not hard-code direction).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Every interactive control in scope MUST present a distinct pressed/active state that appears within approximately 100 ms of pointer-down (not deferred to pointer-up / `click`) and reverts on release or cancellation.
- **FR-002**: Pressed, hover, and focus states MUST be mutually visually distinguishable for every interactive control, and disabled/loading controls MUST NOT show a pressed state or activate on press.
- **FR-003**: All component state transitions (overlay open/close, panel expand/collapse, toggle switch, view swap, gallery image change) MUST use physically believable motion with natural deceleration rather than constant-speed or generic ease curves.
- **FR-004**: Every animated transition MUST be interruptible and reversible mid-flight, animating from the current on-screen (presentation) value with no jump, and MUST NOT lock out user input while playing.
- **FR-005**: When `prefers-reduced-motion: reduce` is set, no in-scope component MUST translate, scale, or spring; transitions MUST reduce to a brief opacity change or an instant state swap, and skeleton loaders MUST NOT animate.
- **FR-006**: All motion durations and easing/spring parameters MUST come from a single shared set of motion tokens defined once in the theme layer; per-component ad hoc durations or curves MUST NOT be introduced.
- **FR-006a**: Spring/interruptible motion and 1:1 drag/swipe gestures MUST be implemented via a single focused motion/gesture library, consumed only through a shared wrapper/hook layer so no component depends on the library directly; trivial state transitions (hover, simple show/hide, pressed state) MUST stay CSS-only rather than routed through the library. Adding more than one such library is out of scope.
- **FR-007**: Overlays (`Modal` in both `center` and `end` forms, `GalleryFullscreenViewer`) MUST render a backdrop that dims and softly blurs the underlying content, with a graceful solid-dim fallback where backdrop blur is unavailable, and the overlay surface MUST use the design system's floating-element elevation.
- **FR-008**: Overlays MUST trap keyboard focus while open, MUST restore focus to the triggering control on close by any dismissal path, and MUST prevent the background page from scrolling while open.
- **FR-009**: All text and controls rendered on an overlay (including over a blurred backdrop showing imagery) MUST meet WCAG 2.1 AA contrast.
- **FR-010**: Dismissible sheets/drawers MUST support a drag/swipe-to-dismiss gesture that tracks the pointer 1:1 from the grab offset. On release the sheet MUST dismiss when it has been dragged past ~40–50% of its own size in the dismiss direction **OR** released with outward velocity above a defined threshold; otherwise it MUST spring back to fully open. Button and keyboard dismissal MUST remain always available.
- **FR-011**: A drag that begins on scrollable overlay content away from its scroll boundary MUST scroll that content rather than initiating dismissal.
- **FR-012**: The fullscreen gallery MUST support horizontal swipe to move between images on touch devices, keeping thumbnail selection in sync, while retaining the existing thumbnail buttons and keyboard navigation.
- **FR-013**: Every gesture-driven outcome MUST have an equivalent, visible non-gesture control and keyboard binding; no outcome may be reachable by a single input modality only.
- **FR-014**: Components implementing the same interaction concept (selection toggle, dismissal, expand/collapse) MUST each resolve to one documented, consistently applied pattern with a single shared focus-indicator treatment across the app.
- **FR-015**: Display/large text (page headers, pillar/section headers, single-record showcase titles) MUST apply deliberate tracking and line-height tokens; body-text hierarchy MUST be carried by weight, size, and color rather than underline-as-emphasis or all-caps (the brand wordmark is exempt).
- **FR-016**: The feature MUST produce a written component audit as a standalone `audit.md` in the feature directory — one row per component enumerated in Scope — assigning each a disposition of `conforms`, `refine`, or `rework`, naming the specific HIG principle(s) at stake and the installed design skill(s) (`apple-design`, `emil-design-eng`, `animate`) consulted for it. The audit is produced during planning and every change task MUST trace back to an audit row.
- **FR-017**: The improvement plan MUST be prioritized and incrementally shippable so that each user story can be delivered and validated on its own.
- **FR-018**: No change in this feature MUST regress WCAG 2.1 AA conformance: automated accessibility scans, contrast checks, keyboard-operability checks, accessible-name checks, and heading-order checks MUST pass at the same or a better rate than before the change, on both light and dark themes.
- **FR-019**: No change MUST violate the constitution's Tailwind "UI Design System & Styling" rules (CSS-first theme tokens, warm-neutral palette, card pattern, skeleton-first loading, no-layout-shift, dual responsive layouts, 44×44 px touch targets, current v4 utility naming, no unjustified custom CSS).
- **FR-020**: Every user flow whose components change MUST have corresponding end-to-end coverage added or updated under `e2e/` per the constitution's Development Workflow gate.
- **FR-021**: Hover-only affordances MUST have an equivalent state for touch/non-hover input across all in-scope components.
- **FR-022**: Motion MUST sustain 60 fps during transitions on a mid-tier device target (modeled as ≈4× CPU throttling in browser dev tools / a "low-tier mobile" profile), holding a per-frame budget of ~16 ms; when that budget is exceeded the component MUST degrade to a simpler transition rather than drop frames or block input.

### Key Entities

- **Component Audit Entry**: one record per in-scope component — its name, current disposition (`conforms` / `refine` / `rework`), the HIG principle(s) it currently falls short on, the design skill(s) consulted, the specific changes proposed, and which user story delivers them.
- **Interaction Pattern**: a named, documented canonical behavior for a shared concept (e.g. "binary switch", "segmented selector", "dismissible sheet", "disclosure/expand") — its affordance, states, motion token usage, focus treatment, and the components that must conform to it.
- **Motion Token**: a single shared, named motion definition (duration + spring/easing parameters, plus its reduced-motion fallback) referenced by every animated component.
- **Elevation / Material Treatment**: the defined backdrop and surface treatment for a layer (dim level, blur amount, fallback, shadow tier) applied consistently to all overlays.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of in-scope interactive controls show a pressed-state acknowledgement within ~100 ms of pointer-down, verified by an interaction audit covering every control.
- **SC-002**: 100% of components enumerated in Scope have a row in `audit.md` with a disposition and a named HIG principle and design skill; no component is left unassessed, and no change task exists without a matching audit row.
- **SC-003**: For the modal, the end-drawer, and the gallery, interrupting a transition (re-triggering or grabbing it mid-flight) never produces a visible jump — verified across all three on desktop and touch.
- **SC-004**: With `prefers-reduced-motion: reduce` enabled, zero in-scope components animate position or scale and zero skeletons pulse; only opacity changes ≤ a single short token duration remain.
- **SC-005**: Zero WCAG 2.1 AA regressions: automated accessibility and contrast suites pass at the same or higher rate than the pre-change baseline on both themes, and the four latent focus/scroll gaps in the current `Modal` (focus trap, focus restore, scroll lock, backdrop distinction) are closed.
- **SC-006**: Exactly one shared set of motion tokens is referenced by every animated in-scope component — no component defines its own duration or curve.
- **SC-007**: Each shared interaction concept (selection toggle, dismissal, expand/collapse) resolves to exactly one documented pattern, and every instance in the codebase conforms to it.
- **SC-008**: Every gesture-driven outcome (sheet dismissal, gallery navigation) has a verified equivalent button + keyboard path; automated e2e covers both the gesture and the non-gesture path for each affected flow.
- **SC-009**: In a side-by-side comparison of the refreshed interactions against the current build, at least 8 of 10 people asked rate the refreshed version as feeling more responsive and more polished.
- **SC-010**: Every transition holds a sustained 60 fps on the mid-tier device target (≈4× CPU throttle / low-tier mobile profile), or provably falls back to a simpler transition, with no input blocked during animation.

## Assumptions

- **Component-level, not page-level**: scope is the reusable components under `frontend/src/components/**` and the supporting theme tokens; the dual desktop/mobile page layouts, routing, and information architecture are unchanged.
- **Works within the existing brand system**: no change to the `@theme` palette, the `Anton` display typeface choice, or the constitution's Tailwind rules; where Apple guidance conflicts with those or with WCAG 2.1 AA, the constitution's existing rules and Principle X win (Principle XI is explicit about this).
- **Spec 058 accessibility hardening is the baseline**: all the contrast/border/focus decisions documented across spec 058 and earlier specs are treated as constraints to preserve, not revisit.
- **One focused motion/gesture library, wrapped**: per the Session 2026-09-05 clarification, spring motion and drag/swipe gestures are built on a single dedicated library accessed only through a shared wrapper layer; the specific library and the wrapper's API are a planning decision, but "hand-roll everything in CSS" and "add multiple animation libraries" are both ruled out. Trivial CSS transitions stay CSS.
- **Touch + keyboard parity is mandatory**: every gesture is an enhancement layered on top of an existing accessible control, never a replacement.
- **Mid-range device target**: "smooth" means a sustained 60 fps (not 120 fps ProMotion) judged against a mid-tier device modeled as ≈4× CPU throttling in browser dev tools; flagship-only smoothness is not sufficient and desktop-only verification is not sufficient.
- **LTR baseline**: the app is currently left-to-right; treatments should avoid hard-coding direction but full RTL support is not being added here.
- **Brand SVG filters** (`VinylmaniaGrungeFilter`) are decorative; they are reviewed for motion/appearance conformance only and are unlikely to change.
- **e2e coverage** for affected flows will be authored as part of this feature per the constitution, using the existing Playwright setup and provider stubs.
- **Delivery is incremental**: the five user stories are independently shippable; P1 stories (1 and 2) deliver the bulk of the perceived improvement and can ship before P2 stories.
