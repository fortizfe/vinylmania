interface StarRatingProps {
  /** Current rating 0–5; 0 = unrated. */
  value: number;
  onChange: (rating: number) => void;
  disabled?: boolean;
}

/**
 * Atomic 5-star rating control. Tapping the currently-active star clears the
 * rating to 0 (R5). Dark-mode aware via Tailwind v4 utilities.
 */
export function StarRating({ value, onChange, disabled = false }: StarRatingProps) {
  function handleClick(star: number) {
    if (disabled) return;
    onChange(value === star ? 0 : star);
  }

  return (
    <div role="group" aria-label="Rating" className="flex items-center gap-1">
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
            className={[
              'flex min-h-11 min-w-11 items-center justify-center rounded transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary',
              disabled
                ? 'cursor-not-allowed opacity-40'
                : 'cursor-pointer hover:text-accent',
              filled ? 'text-accent' : 'text-stone-300 dark:text-stone-600',
            ].join(' ')}
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
