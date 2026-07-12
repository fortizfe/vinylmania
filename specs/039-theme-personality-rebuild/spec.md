# Feature Specification: Theme Personality Rebuild (Light & Dark Mode)

**Feature Branch**: `039-theme-personality-rebuild`

**Created**: 2026-07-12

**Status**: Draft

**Input**: User description: "Implementa la HU @.hu/theme-personality-rebuild.md. Toma libertad para decidir mejores colores"

## Clarifications

### Session 2026-07-12

- Q: Which titles get the Anton display typeface? → A: Anton applies to page headers, dashboard/landing section ("pillar") headers, and single-record showcase titles (Record/Release/Master Release Detail page titles) — never to repeated per-item titles inside dense lists/grids (e.g., each release name in Search Results or Library grid cards).
- Q: How should the indigo (primary) and amber (brand) accents divide responsibility once amber is available app-wide? → A: Indigo remains the primary-action color everywhere (main CTA buttons, active/selected states, primary links); amber is used for secondary emphasis (highlights, badges, hover accents, decorative brand moments), consistent with its current landing-page usage.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - A theme with personality, across the whole app, in both modes (Priority: P1)

As a collector who uses Vinylmania to rate music and organize their collection, I
want the app to have a distinctive, coherent visual identity — in both light and
dark mode — that reflects the rock/metal personality already present in the logo
and the landing page, instead of feeling like a generic template, so that the
experience of using the app feels as considered as the content (rock/metal vinyl
collections) it manages.

**Why this priority**: This is the entire scope of the feature — a single,
cohesive visual rebuild of the shared theme foundation and its application across
every existing screen. It is not divisible into independently valuable slices:
partial application (e.g., only the token layer, without applying it to screens)
would leave the app visually inconsistent, which is the exact problem being
solved.

**Independent Test**: Toggle between light and dark mode on any existing screen
and confirm the palette, typography, borders, and shadows consistently reflect
the new theme rather than the previous generic gray/slate look — verified across
all screens and the header, not just the landing page.

**Acceptance Scenarios**:

1. **Given** the app's shared theme tokens, **When** they are inspected after this
   feature ships, **Then** a warm-neutral palette (stone-family, not cool
   gray/slate) exists for backgrounds, text, and borders, valid in both light and
   dark mode, replacing the `gray-*`/`slate-*` tones used today across
   components and screens.
2. **Given** the same tokens, **When** the available accent colors are reviewed,
   **Then** more than one brand accent is usable — at minimum the existing
   indigo primary accent and the amber accent currently limited to the landing
   page — available for use outside the landing page, with indigo remaining
   the primary-action color everywhere and amber used for secondary emphasis
   (highlights, badges, hover accents, decorative brand moments).
3. **Given** dark mode, **When** it is enabled on any screen (not just the
   landing page), **Then** primary surfaces use a near-black base consistent
   with the one already used on the landing page and logo (or a tone from the
   same family), not the generic gray-950/gray-900 used elsewhere today.
4. **Given** light mode, **When** it is enabled on any screen, **Then** it uses
   the same warm-neutral family (not the current generic white/cool-gray) while
   keeping enough contrast for extended reading.
5. **Given** a page header, a dashboard/landing section ("pillar") header, or a
   single-record showcase title (Record/Release/Master Release Detail page
   title), **When** it renders on any screen, **Then** it consistently uses the
   brand's display typography, without causing layout shift while the font
   loads (same standard already applied to the wordmark) — **and** repeated
   per-item titles inside dense lists/grids (e.g., each release name in Search
   Results or Library grid cards) keep the regular body typeface, not Anton.
6. **Given** the shared atomic UI components (Card, Button, Badge, Avatar,
   Input, Modal, Checkbox, Skeleton, StarRating, ReleaseRatingBadge), **When**
   inspected after the rebuild, **Then** all of them use the new theme tokens
   (no hardcoded or loose gray/slate colors), while keeping their existing card
   pattern (rounded corners, border, shadow, centralized padding) and full
   dark-mode support.
7. **Given** any existing screen (Landing, Dashboard, Search Results, Library
   List, Wishlist, Record Detail, Release Detail, Master Release Detail,
   Profile, Discogs Callback) and the app header, **When** visited in light mode
   and in dark mode, **Then** they visually reflect the new theme (palette,
   title typography, borders/shadows) consistently with one another — no screen
   is left with the previous generic look.
8. **Given** the skeleton/loading states of any screen, **When** shown during an
   asynchronous load, **Then** they also reflect the new color tokens (not the
   current generic gray placeholder colors), while keeping the exact same
   shape/dimensions as the final content (existing "no layout shift" rule).
9. **Given** the rating bands (low/medium/high) and the unscored placeholder,
   **When** reviewed after this feature, **Then** they remain semantically
   unchanged — they keep communicating low/medium/high with the same functional
   colors; this rebuild does not reinterpret them.
10. **Given** any text/background pairing introduced or modified by the new
    theme (warm neutrals, amber accent, dark surface, display typography),
    **When** its contrast is measured, **Then** it meets at least WCAG 2.1 AA
    (4.5:1 normal text, 3:1 large text/non-text elements).
11. **Given** the project constitution, **When** this feature is completed,
    **Then** the "Visual lightness" section (and any necessary nuance to
    "Theme-variable dark mode") is updated to reflect the new visual direction,
    the rest of "UI Design System & Styling" stays intact, and the constitution
    version is bumped per its own governance policy.
12. **Given** any screen or component already covered by existing unit/e2e
    tests, **When** this feature is completed, **Then** that functional (not
    visual) behavior keeps passing unchanged — this feature does not alter
    business logic, data, routes, or behavior, only appearance.

---

### Edge Cases

- What happens to non-default states (hover, focus-visible, disabled, error) of
  interactive components under the new palette — do they still meet WCAG AA
  contrast, not just the default state?
- What happens to the rating band colors (unchanged by design) when placed
  against the new warm-neutral surfaces — do low/medium/high still read clearly
  against the new backgrounds?
- How does the system handle the display typeface failing to load or loading
  slowly on a section title — does the fallback font preserve layout
  dimensions so no shift occurs?
- What happens on a screen where part of the content has finished loading
  (new-theme styling) while a sibling section is still showing a skeleton —
  do both visually belong to the same theme rather than clashing?
- How does an SVG icon that is recolored via the new tokens behave in both
  light and dark mode — does it stay legible against both the near-black dark
  surface and the warm-neutral light surface?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The shared theme MUST define a warm-neutral color palette
  (stone-family, not cool gray/slate) for backgrounds, text, and borders,
  usable in both light and dark mode, replacing the `gray-*`/`slate-*` tones
  currently used across components and screens.
- **FR-002**: The shared theme MUST expose more than one brand accent color for
  use anywhere in the app, including at minimum the existing indigo primary
  accent and the amber accent currently limited to the landing page. Indigo
  MUST remain the primary-action color everywhere (main CTA buttons,
  active/selected states, primary links); amber MUST be used for secondary
  emphasis (highlights, badges, hover accents, decorative brand moments),
  consistent with its current landing-page usage — this rebuild MUST NOT
  replace indigo as the primary-action color on any existing screen.
- **FR-003**: Dark mode surfaces on every screen MUST use a near-black base
  color consistent with the one already used on the landing page and logo (or a
  color from the same family), replacing the generic `gray-950`/`gray-900`
  currently used elsewhere.
- **FR-004**: Light mode surfaces on every screen MUST use the same
  warm-neutral family (not the current generic white/cool-gray), while
  preserving sufficient contrast for extended reading.
- **FR-005**: Page headers, dashboard/landing section ("pillar") headers, and
  single-record showcase titles (Record/Release/Master Release Detail page
  titles) MUST consistently use the brand's display typography, without
  causing layout shift while the font loads. Repeated per-item titles inside
  dense lists/grids (e.g., each release name in Search Results or Library grid
  cards) MUST keep the regular body typeface, not the display typeface.
- **FR-006**: All shared atomic UI components (Card, Button, Badge, Avatar,
  Input, Modal, Checkbox, Skeleton, StarRating, ReleaseRatingBadge, and any
  other shared component under the same `components/ui/` directory, e.g.
  ThemeToggle, BackLink, InlineEditableField) MUST use
  the new theme tokens exclusively (no hardcoded gray/slate colors), while
  preserving their existing card pattern (rounded corners, border, shadow,
  centralized padding) and full dark-mode support.
- **FR-007**: Every existing screen (Landing, Dashboard, Search Results,
  Library List, Wishlist, Record Detail, Release Detail, Master Release
  Detail, Profile, Discogs Callback) and the app header MUST visually reflect
  the new theme consistently, in both light and dark mode.
- **FR-008**: Skeleton/loading states on every screen MUST use the new theme's
  color tokens instead of the current generic gray tokens, while preserving
  identical shape/dimensions to the final loaded content (no layout shift).
- **FR-009**: The rating bands (low/medium/high) and the "unscored" placeholder
  MUST remain semantically and visually unchanged by this rebuild.
- **FR-010**: Every text/background pairing introduced or modified by the new
  theme MUST meet WCAG 2.1 AA contrast (4.5:1 normal text, 3:1 large
  text/non-text elements).
- **FR-011**: The project constitution's "Visual lightness" rule (and any
  necessary nuance to "Theme-variable dark mode") MUST be amended to reflect
  the new visual direction, leaving the rest of the "UI Design System &
  Styling" section intact, with the constitution version bumped per its own
  governance policy.
- **FR-012**: Existing functional behavior covered by current unit/e2e tests
  (business logic, data, routing) MUST remain unchanged — this rebuild is
  visual only.
- **FR-013**: Existing inline SVG icons MUST be recolored to use the new theme
  tokens; this rebuild MUST NOT introduce new illustrative imagery, photography,
  or an icon library dependency.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of existing screens (the 10 listed pages plus the app
  header) visibly reflect the new theme in both light and dark mode, verified
  by visual audit.
- **SC-002**: Zero remaining hardcoded `gray-*`/`slate-*` utility usages in UI
  components outside the new `@theme` tokens, except where explicitly
  justified (same exception bar the constitution already requires).
- **SC-003**: 100% of new or modified text/background pairings meet WCAG AA
  contrast (4.5:1 normal text, 3:1 large text/non-text elements).
- **SC-004**: The existing unit and e2e test suite passes with zero functional
  changes, only snapshot/selector adjustments where the visual change affects
  them.
- **SC-005**: The constitution amendment is merged before or together with the
  visual rebuild.

## Assumptions

- Color freedom: the user has explicitly granted freedom to choose the final
  color values. The starting point is the palette already partially present in
  the codebase (indigo primary, amber accent, near-black dark surface, and the
  warm-neutral tones used in the logo design brief), generalized and refined
  as needed across the rest of the app — this is not a from-scratch palette.
  Exact tonal values are finalized during planning.
- Extending the display typeface (`Anton`) to page/section-level titles (not
  only the brand wordmark) is in-scope, reversing the previous restriction
  that limited it strictly to the wordmark — but it is scoped to page headers,
  pillar/section headers, and single-record showcase titles only (see
  Clarifications); it never applies to body text, labels, data values, or
  repeated per-item titles in dense lists/grids.
- The exact treatment of "more texture and character" in borders and shadows
  (border weight, radii, elevation, any punctual use of grunge texture beyond
  the wordmark) is a planning-phase decision, not a closed requirement here —
  the acceptance bar is a recognizable, consistent, accessible result, not a
  pixel-exact spec.
- The rating bands and the "unscored" badge are functional colors (semantic
  low/medium/high), not decorative ones, and stay out of this personality
  redesign.
- No new illustrative imagery, photography, or icon library is introduced;
  existing inline SVG icons are only recolored to the new tokens.
- The constitution amendment (updated "Visual lightness" text and Sync Impact
  Report) is drafted during the planning phase of this feature, with the final
  wording and version bump confirmed before merge, consistent with the
  project's existing constitution amendment process.
