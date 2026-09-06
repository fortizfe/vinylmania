/**
 * The canonical pressed-state (`:active`) feedback for interactive controls
 * (spec 059 US1 — "Response: kill latency" / FR-001..FR-004).
 *
 * `:active` fires natively on pointer-down (with the platform's own cancel
 * hysteresis when the finger drags away), so the acknowledgement is instant
 * and needs no JavaScript — these are plain Tailwind utility strings, never a
 * `frontend/src/motion/**` import.
 *
 * Variants:
 * - `pressable`      standard controls (buttons, icon buttons, chips,
 *                    toggles) — a 3% scale-down + a small brightness nudge.
 * - `pressableCard`  whole-card / whole-row `<Link>`s — a lighter 1% scale so
 *                    a large surface settles rather than lurches.
 * - `pressableRow`   dense form / table rows where any scale reads as jitter —
 *                    the brightness nudge only.
 * - `pressableNudge` `BackLink` — a 2px shift toward the chevron instead of a
 *                    scale, matching the "go back" direction.
 *
 * All variants:
 * - are suppressed for `disabled` controls (`disabled:active:*`, and a
 *   disabled control never matches `:active` in any browser anyway), so a
 *   loading `<Button>` (which sets `disabled`) shows nothing, and
 * - drop the *scale/translate* under `prefers-reduced-motion` while keeping
 *   the non-vestibular brightness shift (research.md R2). The global
 *   `@media (prefers-reduced-motion: reduce)` block in `global.css`
 *   additionally neutralises the transition timing.
 *
 * The transition property list is `transform,filter` plus the
 * colour/opacity properties some consumers previously animated with
 * `transition-colors` — deliberately NOT `box-shadow`, so the shared
 * `focusRing` (a box-shadow ring) still resolves immediately with no
 * mid-transition contrast race (see `focusRing.ts` / the `StarRating` note).
 */
const pressTransition =
  'transition-[transform,filter,color,background-color,border-color,opacity] duration-(--motion-duration-press) ease-out';

const pressBrightness = 'active:brightness-95 dark:active:brightness-110';

const reducedAndDisabledScaleGuards =
  'motion-reduce:active:scale-100 disabled:active:scale-100 disabled:active:brightness-100';

export const pressable = `${pressTransition} ${pressBrightness} active:scale-[0.97] ${reducedAndDisabledScaleGuards}`;

export const pressableCard = `${pressTransition} ${pressBrightness} active:scale-[0.99] motion-reduce:active:scale-100`;

export const pressableRow = `${pressTransition} ${pressBrightness}`;

export const pressableNudge = `${pressTransition} active:-translate-x-0.5 motion-reduce:active:translate-x-0`;
