import { useState } from 'react';
import clsx from 'clsx';

import type { WantEntryDetail } from '../services/wantlistApi';
import { focusRing } from './ui/focusRing';
import { InlineEditableField } from './ui/InlineEditableField';
import { StarRating } from './ui/StarRating';

/**
 * Field surface / label styling mirrored from `MyCopySection` so the wantlist
 * panel and the library's "Your copy" panel read as one system. `border-stone-500`
 * clears the WCAG 2.1 AA 3:1 minimum for UI component boundaries against both
 * the light and dark card surfaces without a `dark:` override — see
 * MyCopySection.tsx for the measured contrast rationale.
 */
const fieldClasses =
  'min-h-11 rounded-xl border border-stone-500 bg-white px-3 py-2 text-sm text-stone-900 focus:border-primary focus:outline-none dark:bg-stone-950 dark:text-stone-100 disabled:opacity-50 disabled:cursor-not-allowed';
const labelClasses = 'text-sm font-medium text-stone-700 dark:text-stone-300';

interface WantlistPanelProps {
  entry: WantEntryDetail;
  /** Persists the personal rating (0..5) to the user's Discogs wantlist. */
  onSaveRating: (rating: number) => Promise<void>;
  /** Persists the wantlist note to the user's Discogs wantlist. */
  onSaveNotes: (notes: string) => Promise<void>;
}

/**
 * Release-detail panel for editing the two fields the Discogs Wantlist API
 * holds per entry — a personal rating and a note (FR-008..FR-010). Per-field
 * autosave, no Save button: the rating saves on star tap, the note on
 * blur/Enter. Analogous to `MyCopySection` for the library.
 */
export function WantlistPanel({ entry, onSaveRating, onSaveNotes }: WantlistPanelProps) {
  const [ratingError, setRatingError] = useState(false);
  const [lastRatingAttempt, setLastRatingAttempt] = useState<number | null>(null);
  const [ratingSaving, setRatingSaving] = useState(false);

  async function handleRatingChange(rating: number) {
    setLastRatingAttempt(rating);
    setRatingError(false);
    setRatingSaving(true);
    try {
      await onSaveRating(rating);
    } catch {
      setRatingError(true);
    } finally {
      setRatingSaving(false);
    }
  }

  return (
    <div>
      <h2 className="mb-3 text-lg font-semibold text-stone-900 dark:text-stone-100">
        Your wishlist notes
      </h2>
      <div className="flex flex-col gap-4">
        {/* Personal rating — a separate star control, not the community badge (FR-010). */}
        <div className="flex flex-col gap-1">
          <span className={labelClasses}>Personal rating</span>
          <StarRating
            value={entry.rating}
            onChange={handleRatingChange}
            disabled={ratingSaving}
            ariaLabel="Personal rating"
          />
          {ratingError && (
            <p
              role="alert"
              className="flex items-center gap-2 text-xs text-red-600 dark:text-red-400"
            >
              Couldn&apos;t save your rating.
              <button
                type="button"
                onClick={() => {
                  if (lastRatingAttempt !== null) {
                    void handleRatingChange(lastRatingAttempt);
                  }
                }}
                className={clsx(
                  'rounded font-medium underline underline-offset-2',
                  focusRing,
                )}
              >
                Try again
              </button>
            </p>
          )}
        </div>

        {/* Notes */}
        <div className="flex flex-col gap-1">
          <span className={labelClasses}>Notes</span>
          <InlineEditableField
            value={entry.notes ?? ''}
            placeholder="Why you want this"
            fieldLabel="Notes"
            onSave={onSaveNotes}
            renderEditor={({ value, onChange, onBlur, onKeyDown, autoFocus }) => (
              <textarea
                aria-label="Notes"
                value={value}
                onChange={(event) => onChange(event.target.value)}
                onBlur={onBlur}
                onKeyDown={onKeyDown}
                autoFocus={autoFocus}
                className={fieldClasses}
              />
            )}
          />
        </div>
      </div>
    </div>
  );
}
