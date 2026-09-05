/**
 * The single canonical focus-visible treatment for every interactive control
 * (spec 059 FR-014 / US5). Replaces the historical per-component variants
 * (`outline-primary`, ad-hoc `focus-visible:ring-*`) noted in the
 * `Button` / `StarRating` comments.
 *
 * Renders as a `box-shadow` ring — not in any `transition-*` property list —
 * so it appears immediately on focus with no mid-transition contrast race
 * (see the `StarRating` comment for the history). Measured ≥ 3:1 against
 * every surface it can sit on, on every platform (WCAG 1.4.11).
 */
export const focusRing =
  'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2';
