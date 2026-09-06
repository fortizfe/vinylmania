import clsx from 'clsx';

import { focusRing } from './focusRing';
import { pressable } from './press';

interface StarRatingProps {
  /** Current rating 0–5; 0 = unrated. */
  value: number;
  onChange: (rating: number) => void;
  disabled?: boolean;
  /**
   * Accessible name for the rating group. Defaults to `Rating`; pass the
   * control's visible label when it differs (WCAG 2.5.3 Label in Name) — e.g.
   * the wantlist panel's "Personal rating".
   */
  ariaLabel?: string;
}

/**
 * Atomic 5-star rating control. Tapping the currently-active star clears the
 * rating to 0 (R5). Dark-mode aware via Tailwind v4 utilities.
 */
export function StarRating({
  value,
  onChange,
  disabled = false,
  ariaLabel = 'Rating',
}: StarRatingProps) {
  function handleClick(star: number) {
    if (disabled) return;
    onChange(value === star ? 0 : star);
  }

  return (
    <div role="group" aria-label={ariaLabel} className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((star) => {
        const filled = star <= value;
        return (
          <button
            key={star}
            type="button"
            aria-label={`${star} stars`}
            aria-pressed={filled}
            disabled={disabled}
            onClick={() => handleClick(star)}
            className={clsx(
              // `focusRing` (shared box-shadow ring) instead of a raw
              // `outline-primary`: the old outline sat in `transition-colors`'
              // property list and the spec-058 contrast helper read it
              // mid-transition as this button's near-invisible unfilled-star
              // gray (1.56:1 light / 2.57:1 dark). A box-shadow ring is not in
              // any transition list, so it resolves immediately — see
              // focusRing.ts. `pressable` adds the per-star press scale and
              // owns the `transform,filter,color,…` transition.
              'flex min-h-11 min-w-11 items-center justify-center rounded',
              focusRing,
              pressable,
              disabled
                ? 'cursor-not-allowed opacity-40'
                : 'cursor-pointer hover:text-accent',
              filled ? 'text-accent' : 'text-stone-300 dark:text-stone-600',
            )}
          >
            <svg
              viewBox="0 0 20 20"
              fill="currentColor"
              className="h-5 w-5"
              aria-hidden="true"
            >
              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
            </svg>
          </button>
        );
      })}
    </div>
  );
}
