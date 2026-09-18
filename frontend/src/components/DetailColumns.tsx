import type { ReactNode } from 'react';

interface DetailColumnsProps {
  /** Cards for the left column, in fixed display order (research.md Decision 3). */
  left: ReactNode;
  /** Cards for the right column, in fixed display order (research.md Decision 3). */
  right: ReactNode;
}

/**
 * Shared two-column detail layout (feature 064, contracts/DetailColumns.contract.md).
 *
 * Each column is its own independent vertical flow (`flex flex-col gap-4`) —
 * neither is a `col-span` row shared with the other, so one column's total
 * height never creates a gap while the other "catches up" (research.md
 * Decisions 2 & 4). A height difference between `left` and `right` is
 * expected and intentionally left uncorrected (no stretching).
 *
 * Below `lg` the outer grid collapses to one column, so `left`'s cards render
 * fully, then `right`'s cards, in that fixed order (research.md Decision 5).
 */
export function DetailColumns({ left, right }: DetailColumnsProps) {
  return (
    <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-2">
      <div className="flex flex-col gap-4">{left}</div>
      <div className="flex flex-col gap-4">{right}</div>
    </div>
  );
}
