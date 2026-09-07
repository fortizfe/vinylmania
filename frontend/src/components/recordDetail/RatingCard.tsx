import { useState } from 'react';
import clsx from 'clsx';

import type { RatingPresentation } from '../../lib/releaseRating';
import { Card } from '../ui/Card';
import { focusRing } from '../ui/focusRing';
import { ReleaseRatingBadge } from '../ui/ReleaseRatingBadge';
import { StarRating } from '../ui/StarRating';
import { RECORD_DETAIL_TESTIDS } from './testIds';

/**
 * Standalone rating card shared by the three record-detail views (feature 063,
 * contracts/ui-contracts.md §C4). Always rendered by `RecordDetailLayout` —
 * it never returns `null` (FR-004).
 *
 * The **community half** is the Discogs community rating badge, its vote
 * count, and the have/want counts. The **personal half** is the user's own
 * rating: an editable `<StarRating>` when `personal` is provided (library /
 * wishlist views, US2), or read-only "Sin valorar" text when it is absent
 * (pure search).
 *
 * No state is ever conveyed by colour alone (FR-008 / Principle X): the badge
 * carries its numeric value + `role="status"` label, and every count is text.
 */

const HEADING_ID = 'record-detail-rating-heading';

const labelClasses = 'text-sm font-medium text-stone-700 dark:text-stone-300';
const mutedTextClasses = 'text-sm text-stone-500 dark:text-stone-400';

interface RatingCardProps {
  community: {
    presentation: RatingPresentation;
    count: number;
    have: number | null;
    want: number | null;
  };
  personal?: {
    value: number;
    onSave: (rating: number) => Promise<void>;
    saving: boolean;
  };
}

const PERSONAL_SAVE_ERROR = 'No se pudo guardar tu valoración.';

export function RatingCard({ community, personal }: RatingCardProps) {
  const { presentation, count, have, want } = community;
  const isUnrated = presentation.band === 'unrated';

  // Retry-on-failure for the personal rating, mirroring the pattern the
  // now-deleted `WantlistPanel` used (FR-007). The star control stays
  // controlled by `personal.value` (the persisted rating), so a failed save
  // visibly snaps back — the alert + "Reintentar" is the only recovery path,
  // never colour alone (Principle X).
  const [saveError, setSaveError] = useState(false);
  const [lastAttempt, setLastAttempt] = useState<number | null>(null);

  async function handlePersonalSave(rating: number) {
    if (!personal) return;
    setLastAttempt(rating);
    setSaveError(false);
    try {
      await personal.onSave(rating);
    } catch {
      setSaveError(true);
    }
  }

  return (
    <Card padding="sm" data-testid={RECORD_DETAIL_TESTIDS.RATING_CARD}>
      <section aria-labelledby={HEADING_ID}>
        <h2
          id={HEADING_ID}
          className="mb-3 text-lg font-semibold text-stone-900 dark:text-stone-100"
        >
          Valoración
        </h2>

        {/*
          Both halves share a fixed min-height so the empty / populated / error
          states never shift the surrounding layout (FR-021 / SC-008). Kept in
          sync with RecordDetailSkeleton's `min-h-[7.5rem]` rating block.
        */}
        <div className="flex min-h-[7.5rem] flex-col gap-4 sm:flex-row sm:gap-8">
          {/* Community half */}
          <div className="flex flex-1 flex-col gap-2">
            <span className={labelClasses}>Comunidad de Discogs</span>
            <div className="flex items-center gap-2">
              <ReleaseRatingBadge
                displayValue={presentation.displayValue}
                band={presentation.band}
              />
              {isUnrated ? (
                <span className={mutedTextClasses}>Sin valoraciones</span>
              ) : (
                <span className={mutedTextClasses}>({count})</span>
              )}
            </div>

            {(have !== null || want !== null) && (
              <p className={mutedTextClasses}>
                {have !== null && <span>{have} lo tienen</span>}
                {have !== null && want !== null && <span aria-hidden="true"> · </span>}
                {want !== null && <span>{want} lo quieren</span>}
              </p>
            )}
          </div>

          {/*
            Personal half. Editable <StarRating> when `personal` is provided
            (library / wishlist); a plain-text "Sin valorar" — never a disabled
            control (§C7) — when it is absent (pure search).
          */}
          <div className="flex flex-1 flex-col gap-2">
            <span className={labelClasses}>Tu valoración</span>
            {personal ? (
              <>
                <StarRating
                  value={personal.value}
                  onChange={handlePersonalSave}
                  disabled={personal.saving}
                  ariaLabel="Tu valoración"
                />
                {saveError && (
                  <p
                    role="alert"
                    className="flex flex-wrap items-center gap-2 text-xs text-red-600 dark:text-red-400"
                  >
                    {PERSONAL_SAVE_ERROR}
                    <button
                      type="button"
                      onClick={() => {
                        if (lastAttempt !== null) {
                          void handlePersonalSave(lastAttempt);
                        }
                      }}
                      className={clsx(
                        'rounded font-medium underline underline-offset-2',
                        focusRing,
                      )}
                    >
                      Reintentar
                    </button>
                  </p>
                )}
              </>
            ) : (
              <p className={mutedTextClasses}>Sin valorar</p>
            )}
          </div>
        </div>
      </section>
    </Card>
  );
}
