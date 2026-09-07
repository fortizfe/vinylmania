import { useId } from 'react';
import clsx from 'clsx';

import { m, spring, usePrefersReducedMotion } from '../../motion';
import type { CollectionValuation } from '../../services/collectionStatsApi';
import type { ValuationStatus } from '../../queries/collectionStatsQueries';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { formatCurrency } from './formatCurrency';

interface CollectionValuationCardProps {
  valuation: CollectionValuation | null;
  /** Fraction in `[0, 1]` of instances attempted so far. */
  progress: number;
  status: ValuationStatus;
  /**
   * Discs whose price lookup failed transiently and can be retried on their own
   * (US3, FR-025). `0` hides the retry affordance.
   */
  retryable?: number;
  /** Re-price only the failed discs — wired to `retry('failed')`. */
  onRetryFailed?: () => void;
}

const computingStatuses: ValuationStatus[] = ['loading', 'partial'];

/**
 * Once past the first chunk, this many still-unpriced discs means the run will
 * not finish promptly, so we surface the explicit "come back later" state
 * (FR-023a). One batch is 25 discs — this is roughly two more batches.
 */
const LONG_RUNNING_REMAINING = 50;

function remainingDiscs(valuation: CollectionValuation): number {
  const attempted =
    valuation.coveredCount +
    valuation.uncovered.noMarketData +
    valuation.uncovered.noCondition;
  return Math.max(0, valuation.totalCount - attempted);
}

/**
 * Leads Block 2: the running total in the user's Discogs currency (FR-019), the
 * "estimado sobre X de Y discos" coverage label (FR-017), and a polite live
 * region + progress bar while the chunk loop runs (FR-020).
 *
 * On a large first run it also shows a calm, non-blocking "come back later"
 * message (FR-023a) and, when some discs failed transiently, a plain-text count
 * plus a real retry control that re-prices only those discs (FR-025). Both are
 * text with real controls — never a colour-only signal (Principle X). The
 * "come back later" copy is deliberately understated, not an alert
 * (apple-design §16 "Delight" — calm, not alarming; consulted `apple-design` /
 * `emil-design-eng`).
 *
 * The total is not tweened digit-by-digit — the spec allows an instant update
 * and the value must stay readable at every frame. On each new estimate the
 * figure re-mounts with a short spring-eased opacity fade (shared
 * `spring.default` token, no bounce) — a plain cross-fade with NO positional
 * move: this is functional content the user is reading, and `animate` /
 * `emil-design-eng` are explicit that such content must not shift for style.
 * The fade alone is enough to register "a newer estimate landed". Dropped
 * entirely under `prefers-reduced-motion` (Principle XI, apple-design §14).
 */
export function CollectionValuationCard({
  valuation,
  progress,
  status,
  retryable = 0,
  onRetryFailed,
}: CollectionValuationCardProps) {
  const labelId = useId();
  const reduceMotion = usePrefersReducedMotion();

  const currency = valuation?.currency ?? null;
  const total = valuation?.estimatedTotal ?? 0;
  const covered = valuation?.coveredCount ?? 0;
  const totalCount = valuation?.totalCount ?? 0;
  const computing = computingStatuses.includes(status);
  const pct = Math.round(Math.min(1, Math.max(0, progress)) * 100);

  const longRunning =
    computing &&
    !!valuation &&
    status === 'partial' &&
    remainingDiscs(valuation) > LONG_RUNNING_REMAINING;

  const showRetryFailed = retryable > 0 && !!onRetryFailed;

  // Announce only the meaningful transitions — the run starting and the run
  // finishing. The per-chunk covered count is deliberately NOT in here: on a
  // large collection the loop resolves ~20 chunks and a polite region that
  // restated "X de Y" each time would be an announcement storm. Sighted users
  // track the fill via the visible progress bar + coverage label; assistive
  // tech can still poll the `progressbar`'s `aria-valuenow` on demand.
  const liveText = computing
    ? 'Calculando la valoración de tu colección…'
    : status === 'complete'
      ? 'Valoración completada.'
      : '';

  return (
    <Card className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <span
          id={labelId}
          className="text-sm font-medium text-stone-500 dark:text-stone-400"
        >
          Total estimated value
        </span>

        <m.span
          key={`${currency ?? 'none'}:${total}`}
          aria-labelledby={labelId}
          className="font-display text-4xl leading-display tracking-display text-stone-900 tabular-nums dark:text-stone-100"
          initial={reduceMotion ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={reduceMotion ? { duration: 0 } : spring.default}
        >
          {formatCurrency(total, currency)}
        </m.span>

        {valuation && (
          <span className="text-sm text-stone-500 tabular-nums dark:text-stone-400">
            estimado sobre {covered} de {totalCount} discos
          </span>
        )}
      </div>

      {computing && (
        <div className="flex flex-col gap-1.5">
          <div
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={pct}
            aria-label="Progreso de la valoración"
            className="h-1.5 w-full overflow-hidden rounded-full bg-stone-200 dark:bg-stone-800"
          >
            <div
              className={clsx(
                'h-full rounded-full bg-primary transition-[width] duration-(--motion-duration-fade) ease-out dark:bg-primary-text',
                'motion-reduce:transition-none',
              )}
              style={{ width: `${Math.max(4, pct)}%` }}
            />
          </div>
        </div>
      )}

      {longRunning && (
        <p className="text-sm text-stone-500 dark:text-stone-400">
          Esto puede tardar un rato. Puedes cerrar esta página y volver más tarde: el
          progreso se guarda y la valoración continúa donde la dejaste.
        </p>
      )}

      {showRetryFailed && (
        <div className="flex flex-col items-start gap-2">
          <p className="text-sm text-stone-600 dark:text-stone-300">
            No pudimos consultar el precio de {retryable}{' '}
            {retryable === 1 ? 'disco' : 'discos'}. Puedes reintentarlo sin repetir toda
            la valoración.
          </p>
          <Button variant="secondary" onClick={onRetryFailed}>
            Reintentar esos discos
          </Button>
        </div>
      )}

      <p role="status" aria-live="polite" className="sr-only">
        {liveText}
      </p>
    </Card>
  );
}
