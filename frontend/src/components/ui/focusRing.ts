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
 *
 * `outline-hidden` (not `outline-none`): forced-colors mode strips
 * box-shadows, so the ring vanishes there; Tailwind v4's `outline-hidden`
 * adds a transparent 2px outline only under `forced-colors: active`, which
 * the system colour paints visible (WCAG 2.4.7, spec 067 T050 #1).
 */
export const focusRing =
  'focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2';
