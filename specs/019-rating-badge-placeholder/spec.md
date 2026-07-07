# Feature Specification: Placeholder Rating Badge for Unrated Releases

**Feature Branch**: `019-rating-badge-placeholder`

**Created**: 2026-07-07

**Status**: Draft

**Input**: User description: "Quiero que para los discos que no obtengamos puntuación porque no la tengan o porque haya habido error, en ve de dejarlo sin nada pintemos el mismo componente que cuando si que tienen puntuación, pero el teto será un guión ('-') y el background será gris suave"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Recognize an unrated release at a glance (Priority: P1)

A collector scanning search results or their library sees a rating badge on every card in the same position, whether or not Discogs has a community rating for that release. When no rating is available (the release genuinely has none, or the lookup failed), the badge shows a dash ("-") on a soft gray background instead of disappearing.

**Why this priority**: Today, cards with no rating simply have an empty gap where the badge would sit, which reads as a broken or unfinished layout and makes it unclear whether the absence is intentional (no rating exists) or a bug. Rendering a consistent placeholder badge removes that ambiguity and keeps every card visually uniform.

**Independent Test**: Render a set of cards mixing rated and unrated releases (including one whose rating lookup errors out). Confirm every card shows a badge in the same position; rated cards show the numeric value on its color band, and unrated/errored cards show "-" on a soft gray background.

**Acceptance Scenarios**:

1. **Given** a search-result or library card for a release with no community rating recorded, **When** the card renders, **Then** the rating badge appears in its usual position showing "-" on a soft gray background.
2. **Given** a search-result or library card for a release whose rating lookup fails or times out, **When** the card renders, **Then** the rating badge appears showing "-" on a soft gray background, identical in treatment to a release with no rating.
3. **Given** a search-result or library card for a release with a valid rating, **When** the card renders, **Then** the badge continues to show the existing numeric value and color band (low/medium/high) exactly as before — this feature does not change that behavior.
4. **Given** a mix of rated and unrated cards on the same page, **When** a collector scans the page, **Then** every card shows a badge of the same size, shape, and position, so no card appears to be missing content.

---

### Edge Cases

- A release has a rating count of zero (no votes) even though an average value is present in the data → treated as unrated, shows the placeholder badge.
- A release's average rating value is out of the valid 0–5 range or non-numeric (upstream data anomaly) → treated as unrated, shows the placeholder badge.
- The per-release rating lookup times out or errors while the rest of the card's data loaded successfully → treated as unrated, shows the placeholder badge (consistent with existing error-handling behavior for rating lookups).
- The placeholder badge's dash text and soft gray background must remain visually distinguishable from the existing low/medium/high rating colors, so it is never mistaken for a low rating.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST show a rating badge on every search-result and library card, regardless of whether a valid community rating is available for that release.
- **FR-002**: When a release has no recorded rating, an invalid/out-of-range rating, or its rating lookup failed or timed out, the badge MUST display a dash ("-") as its content instead of a numeric value.
- **FR-003**: When showing the dash placeholder, the badge's background MUST use a soft, muted gray tone that is visually distinct from the existing low/medium/high rating band colors.
- **FR-004**: The placeholder badge MUST reuse the same visual component (shape, size, position, corner rounding, shadow) used for badges that show a numeric rating, differing only in its text content and background color.
- **FR-005**: The placeholder badge's text MUST meet WCAG AA contrast (4.5:1) against its soft gray background, consistent with the contrast guarantee already required for the numeric rating badges.
- **FR-006**: The placeholder badge MUST expose an accessible label that communicates the rating is unavailable (e.g., "Rating not available"), rather than reusing the numeric "Rating X out of 5" label pattern.
- **FR-007**: Existing behavior for releases with valid ratings (numeric value, color band, accessible label) MUST remain unchanged.

### Key Entities

- **Rating Badge**: The small rounded visual element shown on a release card conveying its community rating status. Now has two presentation states: "rated" (numeric value, color-coded band) and "unrated/error" (dash, soft gray background).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of search-result and library cards render a rating badge, eliminating the previous empty-space gap for releases without a rating.
- **SC-002**: The placeholder badge's background color is objectively distinguishable (by contrast/hue) from each of the three existing rating band colors, so it cannot be misread as a low, medium, or high rating.
- **SC-003**: The placeholder badge's text meets the same WCAG AA contrast requirement already verified for the numeric rating badges.

## Assumptions

- This change applies everywhere the existing rating badge component is used today: search-result cards and library ("My Library") cards. It does not add a rating badge to the record detail page, which was explicitly out of scope in the prior rating-badge increment and remains unchanged here.
- "No la tengan" (releases with no rating) and "haya habido error" (lookup errors) are both mapped to the single existing "rating not visible" condition already used by the codebase (no rating data, zero votes, out-of-range value, or failed/timed-out lookup) — no new distinction between these cases is required in the UI; all are shown identically as the dash placeholder.
- The specific soft gray shade and dash text color are a visual-design detail to be finalized during planning/implementation, constrained only by the contrast and distinguishability requirements in FR-003, FR-005, and SC-002.
- No sorting, filtering, or other behavior keyed on rating value changes as part of this increment — this is a presentation-only change to the badge's empty/error state.
