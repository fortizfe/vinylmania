import type { PerDiscValue, PerDiscValueReason } from '../../services/collectionStatsApi';
import { Modal } from '../ui/Modal';
import { formatCurrency } from './formatCurrency';

interface ValuationBreakdownDialogProps {
  open: boolean;
  onClose: () => void;
  /** The complete per-disc list from the final valuation page (data-model §5). */
  rows: PerDiscValue[];
  currency: string | null;
}

/** Text-only reason label — never a colour-coded chip (Principle X, FR-016/018). */
const REASON_LABEL: Record<Exclude<PerDiscValueReason, 'ok'>, string> = {
  no_market_data: 'sin datos de mercado',
  no_condition: 'sin estado',
};

/**
 * The full per-disc breakdown behind the "Ver todos" disclosure — covered rows
 * with their condition-adjusted value, uncovered rows with a written reason.
 * Focus trap, Escape/scrim dismissal and focus restoration all come from
 * `ui/Modal` (spec 059).
 */
export function ValuationBreakdownDialog({
  open,
  onClose,
  rows,
  currency,
}: ValuationBreakdownDialogProps) {
  return (
    <Modal open={open} onClose={onClose} title="Per-disc breakdown" size="lg">
      <div className="max-h-[70vh] overflow-auto">
        <table className="w-full border-collapse text-sm">
          <caption className="sr-only">
            Every copy in your collection with its estimated value or the reason it could
            not be valued.
          </caption>
          <thead>
            <tr className="border-b border-stone-300 text-left dark:border-stone-700">
              <th scope="col" className="py-2 pr-3 font-semibold">
                Record
              </th>
              <th scope="col" className="py-2 pr-3 font-semibold">
                Condition
              </th>
              <th scope="col" className="py-2 pl-3 text-right font-semibold">
                Value
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.instanceId}
                className="border-b border-stone-200 align-top last:border-b-0 dark:border-stone-800"
              >
                <th scope="row" className="py-2 pr-3 font-normal">
                  <span className="block font-medium text-stone-900 dark:text-stone-100">
                    {row.title}
                  </span>
                  <span className="block text-xs text-stone-500 dark:text-stone-400">
                    {row.artist}
                  </span>
                </th>
                <td className="py-2 pr-3 text-stone-700 dark:text-stone-300">
                  {row.mediaCondition ?? '—'}
                </td>
                <td className="py-2 pl-3 text-right tabular-nums text-stone-900 dark:text-stone-100">
                  {row.reason === 'ok' && row.value !== null ? (
                    formatCurrency(row.value, currency)
                  ) : (
                    <span className="text-stone-500 dark:text-stone-400">
                      {REASON_LABEL[row.reason as Exclude<PerDiscValueReason, 'ok'>]}
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Modal>
  );
}
