import { type ReactNode, useState } from 'react';

import { m, motionDuration, usePrefersReducedMotion } from '../../motion';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';

interface CollapsibleFilterPanelProps {
  /** Total number of currently active/selected filter values across all fields (spec Edge Cases: shown as a plain count, not a list). */
  activeCount: number;
  children: ReactNode;
}

/**
 * A single chevron shape. `direction` only sets the rest rotation; the
 * disclosure transition is driven by the tokenized `transition-transform`
 * class on the element so it eases on `--motion-duration-collapse` /
 * `ease-out` and snaps under `prefers-reduced-motion` (global.css guard).
 */
function ChevronIcon({ direction }: { direction: 'up' | 'down' }) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      aria-hidden="true"
      className={
        'h-4 w-4 transition-transform duration-(--motion-duration-collapse) ease-out ' +
        (direction === 'up' ? 'rotate-0' : 'rotate-180')
      }
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12.5L10 7.5L5 12.5" />
    </svg>
  );
}

/**
 * Shared collapsible wrapper for the Search/Library filter forms (feature
 * 038, FR-001-FR-005): starts collapsed on every mount and stays expanded
 * once opened until the user explicitly collapses it again — applying
 * filters inside `children` never auto-collapses it.
 *
 * US2 (spec 059): the disclosure animates measured height + opacity on
 * `--motion-duration-collapse` / `ease-out`; the chevron rotates on the same
 * token. Under `prefers-reduced-motion` the reveal is instant.
 */
export function CollapsibleFilterPanel({
  activeCount,
  children,
}: CollapsibleFilterPanelProps) {
  const [expanded, setExpanded] = useState(false);
  const reduceMotion = usePrefersReducedMotion();

  const revealTransition = reduceMotion
    ? { duration: 0 }
    : { duration: motionDuration.collapse / 1000, ease: [0.23, 1, 0.32, 1] as const };

  if (!expanded) {
    return (
      <Card padding="sm">
        <Button
          type="button"
          variant="secondary"
          onClick={() => setExpanded(true)}
          className="w-full justify-between"
        >
          <span>Filters</span>
          <span className="ml-2 inline-flex items-center gap-2">
            {activeCount > 0 && (
              <span
                data-testid="active-filter-badge"
                aria-hidden="true"
                className="inline-flex min-h-6 min-w-6 items-center justify-center rounded-full bg-primary px-1.5 text-xs font-semibold text-white"
              >
                {activeCount}
              </span>
            )}
            <ChevronIcon direction="down" />
          </span>
        </Button>
      </Card>
    );
  }

  return (
    <Card padding="sm">
      <div className="mb-2 flex items-center justify-between gap-4">
        <span className="text-sm font-medium text-stone-700 dark:text-stone-300">
          Filters
        </span>
        <Button
          type="button"
          variant="secondary"
          size="icon"
          aria-label="Collapse filters"
          onClick={() => setExpanded(false)}
        >
          <ChevronIcon direction="up" />
        </Button>
      </div>
      <m.div
        data-testid="collapsible-filter-body"
        data-reduced-motion={reduceMotion ? 'true' : 'false'}
        initial={{ height: 0, opacity: 0 }}
        animate={{ height: 'auto', opacity: 1 }}
        transition={revealTransition}
        className="overflow-hidden"
      >
        {children}
      </m.div>
    </Card>
  );
}
