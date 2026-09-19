import type { FocusEvent } from 'react';
import clsx from 'clsx';

import type { SourceStatus } from '../services/feedsApi';
import { focusRing } from './ui/focusRing';
import { pressable } from './ui/press';

function WarningIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      className="mr-0.5 inline size-4 align-[-3px]"
    >
      <path strokeLinejoin="round" d="M8 2 1.5 13.5h13L8 2Z" />
      <path strokeLinecap="round" d="M8 6.5v3.25M8 11.75v.01" />
    </svg>
  );
}

interface FeedSourceFilterBarProps {
  sourceStatuses: SourceStatus[];
  selectedSource: string | null;
  onSelectSource: (sourceId: string | null) => void;
}

const baseButtonClassName = clsx(
  // The transparent border and the Highlight fill are no-ops normally; under
  // forced colours they keep the pill outline and set the selected chip
  // apart once `bg-primary` is dropped (FR-016, spec 067 T050 #4).
  'flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-full border border-transparent px-3 py-1 text-sm font-medium',
  'forced-colors:aria-pressed:bg-[Highlight] forced-colors:aria-pressed:text-[HighlightText]',
  focusRing,
  pressable,
);
const activeClassName = 'bg-primary text-white';
// Inherits white on the selected chip; muted (>= 4.5:1 on stone-100/200 and
// stone-900/800) otherwise.
const mutedMarkerClassName = 'text-stone-600 dark:text-stone-400';
// Room kept past each edge of the chip row for the 4 px focus ring.
const CHIP_REVEAL_PX = 16;

// Chrome leaves a partly visible element where it is on Tab focus (and
// ignores scroll-padding then), so the row scrolls the focused chip fully in
// itself (WCAG 2.4.11). Horizontal only: scrollIntoView would also scroll the
// page, since the sticky row sits inside the page's scroll-padding-top.
function revealFocusedChip(event: FocusEvent<HTMLDivElement>) {
  const row = event.currentTarget;
  const rowBox = row.getBoundingClientRect();
  const chip = event.target.getBoundingClientRect();
  const overLeft = rowBox.left + CHIP_REVEAL_PX - chip.left;
  const overRight = chip.right - (rowBox.right - CHIP_REVEAL_PX);
  if (overLeft > 0) row.scrollLeft -= overLeft;
  else if (overRight > 0) row.scrollLeft += overRight;
}

const inactiveClassName =
  'bg-stone-100 text-stone-700 hover:bg-stone-200 dark:bg-stone-900 dark:text-stone-200 dark:hover:bg-stone-800';

export function FeedSourceFilterBar({
  sourceStatuses,
  selectedSource,
  onSelectSource,
}: FeedSourceFilterBarProps) {
  // Stable sort: priority sources first, each group preserving array order (spec FR-012).
  const orderedSources = [...sourceStatuses].sort((a, b) => {
    if (a.priority === b.priority) {
      return 0;
    }
    return a.priority ? -1 : 1;
  });

  return (
    // Below sm the chips are one row that scrolls inside itself, so the page
    // never scrolls sideways; p-1 keeps the focus ring clear of the clip edge.
    <div
      role="group"
      aria-label="Filter by source"
      onFocus={revealFocusedChip}
      className="flex flex-nowrap gap-2 overflow-x-auto p-1 sm:flex-wrap sm:overflow-visible"
    >
      <button
        type="button"
        aria-pressed={selectedSource === null}
        onClick={() => onSelectSource(null)}
        className={clsx(
          baseButtonClassName,
          selectedSource === null ? activeClassName : inactiveClassName,
        )}
      >
        All sources
      </button>
      {orderedSources.map((source) => (
        <button
          key={source.sourceId}
          type="button"
          aria-pressed={selectedSource === source.sourceId}
          // Chrome drops the whitespace-only text node below from the
          // computed name ("MetalSucksunavailable"); the label pins it to the
          // visible words (WCAG 4.1.2 / 2.5.3, spec 067 T050 #3).
          aria-label={
            source.status === 'unavailable'
              ? `${source.sourceName} unavailable`
              : undefined
          }
          onClick={() => onSelectSource(source.sourceId)}
          className={clsx(
            baseButtonClassName,
            selectedSource === source.sourceId ? activeClassName : inactiveClassName,
          )}
        >
          {source.status === 'unavailable' ? (
            // One inline wrapper so the space between name and marker is
            // rendered text (flex drops it).
            <span>
              {source.sourceName}{' '}
              <span
                className={clsx(
                  'whitespace-nowrap',
                  selectedSource !== source.sourceId && mutedMarkerClassName,
                )}
              >
                <WarningIcon />
                unavailable
              </span>
            </span>
          ) : (
            source.sourceName
          )}
        </button>
      ))}
    </div>
  );
}
