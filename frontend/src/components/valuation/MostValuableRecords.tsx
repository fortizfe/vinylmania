import { useId } from 'react';

import type { PerDiscValue } from '../../services/collectionStatsApi';
import { Card } from '../ui/Card';
import { formatCurrency } from './formatCurrency';

interface MostValuableRecordsProps {
  /** `valuation.topValuable` — already sorted desc by value, length ≤ 10. */
  records: PerDiscValue[];
  currency: string | null;
}

/**
 * The "most valuable records" highlight list that leads Block 2 alongside the
 * total (FR-015, US2 scenario 7). Each row states its condition and value as
 * text — rank and worth are never carried by colour or size alone
 * (Principle X). Rendered as a labelled `region` so it is a reachable landmark.
 */
export function MostValuableRecords({ records, currency }: MostValuableRecordsProps) {
  const headingId = useId();

  if (records.length === 0) {
    return null;
  }

  return (
    <Card className="flex flex-col gap-3" data-testid="most-valuable-records">
      <section aria-labelledby={headingId} className="flex flex-col gap-3">
        <h3
          id={headingId}
          className="text-base font-semibold text-stone-900 dark:text-stone-100"
        >
          Most valuable records
        </h3>

        <ol aria-labelledby={headingId} className="flex list-none flex-col gap-1 p-0">
          {records.map((record, index) => (
            <li
              key={record.instanceId}
              className="flex items-center gap-3 border-b border-stone-200 py-1.5 last:border-b-0 dark:border-stone-800"
            >
              <span className="w-6 shrink-0 text-right text-sm font-medium tabular-nums text-stone-500 dark:text-stone-400">
                {index + 1}
              </span>
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-sm font-medium text-stone-900 dark:text-stone-100">
                  {record.title}
                </span>
                <span className="truncate text-xs text-stone-500 dark:text-stone-400">
                  {record.artist}
                  {record.mediaCondition ? ` · ${record.mediaCondition}` : ''}
                </span>
              </span>
              <span className="shrink-0 text-sm font-semibold tabular-nums text-stone-900 dark:text-stone-100">
                {record.value === null ? '—' : formatCurrency(record.value, currency)}
              </span>
            </li>
          ))}
        </ol>
      </section>
    </Card>
  );
}
