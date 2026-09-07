import type { RatingPresentation } from '../../lib/releaseRating';
import { Card } from '../ui/Card';
import { ReleaseRatingBadge } from '../ui/ReleaseRatingBadge';
import { RECORD_DETAIL_TESTIDS } from './testIds';

/**
 * Standalone rating card shared by the three record-detail views (feature 063,
 * contracts/ui-contracts.md §C4). Always rendered by `RecordDetailLayout` —
 * it never returns `null` (FR-004).
 *
 * This phase (US1) implements the **community half** — the Discogs community
 * rating badge, its vote count, and the have/want counts — plus a read-only
 * "Sin valorar" state for the personal half when `personal` is absent. The
 * editable personal control (when `personal` is provided) is filled in by
 * US2 (T024) at the marked spot below.
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

export function RatingCard({ community }: RatingCardProps) {
  const { presentation, count, have, want } = community;
  const isUnrated = presentation.band === 'unrated';

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
                {have !== null && want !== null && (
                  <span aria-hidden="true"> · </span>
                )}
                {want !== null && <span>{want} lo quieren</span>}
              </p>
            )}
          </div>

          {/*
            Personal half. This phase renders the read-only state only — a
            plain-text label, never a disabled control (§C7). US2 (T024) adds
            the editable <StarRating value={personal.value}
            onChange={personal.onSave} disabled={personal.saving}
            ariaLabel="Tu valoración" /> + retry-on-failure here when the
            `personal` prop is provided.
          */}
          <div className="flex flex-1 flex-col gap-2">
            <span className={labelClasses}>Tu valoración</span>
            <p className={mutedTextClasses}>Sin valorar</p>
          </div>
        </div>
      </section>
    </Card>
  );
}
