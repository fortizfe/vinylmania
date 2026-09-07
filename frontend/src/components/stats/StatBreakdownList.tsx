import { useId, useState } from 'react';
import clsx from 'clsx';

import type { StatBreakdown } from '../../services/collectionStatsApi';
import { Card } from '../ui/Card';
import { focusRing } from '../ui/focusRing';

interface StatBreakdownListProps {
  title: string;
  breakdown: StatBreakdown;
}

const formatCount = (value: number) => new Intl.NumberFormat('en-US').format(value);

/** One ranked row: label, count, and a length-encoded bar (width ∝ count/max). */
function BarRow({ label, count, max }: { label: string; count: number; max: number }) {
  const pct = max > 0 ? Math.max(2, Math.round((count / max) * 100)) : 0;
  return (
    <li className="flex items-center gap-3 py-1.5">
      <span className="w-28 shrink-0 truncate text-sm text-stone-700 dark:text-stone-300">
        {label}
      </span>
      <span
        aria-hidden="true"
        className="relative h-2 flex-1 overflow-hidden rounded-full bg-stone-200 dark:bg-stone-800"
      >
        <span
          className="absolute inset-y-0 left-0 rounded-full bg-primary dark:bg-primary-text"
          style={{ width: `${pct}%` }}
        />
      </span>
      <span className="w-12 shrink-0 text-right text-sm font-medium tabular-nums text-stone-900 dark:text-stone-100">
        {formatCount(count)}
      </span>
    </li>
  );
}

/**
 * A ranked facet breakdown (decade / genre / style / label). The `others`
 * remainder — the tail Discogs data was collapsed into server-side — is a
 * keyboard-operable disclosure with an accessible name ("Otros (N)"), never a
 * colour-only affordance (Principle X, FR-011a).
 */
export function StatBreakdownList({ title, breakdown }: StatBreakdownListProps) {
  const headingId = useId();
  const panelId = useId();
  const [expanded, setExpanded] = useState(false);

  const { buckets, others } = breakdown;
  const max = buckets.reduce((acc, bucket) => Math.max(acc, bucket.count), 0);

  return (
    <Card padding="sm" className="flex flex-col gap-2">
      <h3
        id={headingId}
        className="text-sm font-semibold text-stone-900 dark:text-stone-100"
      >
        {title}
      </h3>

      {buckets.length === 0 ? (
        <p className="text-sm text-stone-500 dark:text-stone-400">
          No data for this breakdown yet.
        </p>
      ) : (
        <ol aria-labelledby={headingId} className="flex list-none flex-col p-0">
          {buckets.map((bucket) => (
            <BarRow
              key={bucket.label}
              label={bucket.label}
              count={bucket.count}
              max={max}
            />
          ))}
        </ol>
      )}

      {others && (
        <div className="border-t border-stone-300 pt-2 dark:border-stone-700">
          <button
            type="button"
            aria-expanded={expanded}
            aria-controls={expanded ? panelId : undefined}
            onClick={() => setExpanded((value) => !value)}
            className={clsx(
              'inline-flex min-h-11 items-center gap-1 rounded-lg px-1 text-sm font-medium text-primary dark:text-primary-text',
              focusRing,
            )}
          >
            <span
              aria-hidden="true"
              className={clsx('transition-transform', expanded && 'rotate-90')}
            >
              ▸
            </span>
            Otros ({formatCount(others.count)})
          </button>
          {expanded && (
            <p
              id={panelId}
              className="px-1 pb-1 text-sm text-stone-500 dark:text-stone-400"
            >
              {formatCount(others.hiddenBuckets)} more values, {formatCount(others.count)}{' '}
              {others.count === 1 ? 'record' : 'records'} combined.
            </p>
          )}
        </div>
      )}
    </Card>
  );
}
