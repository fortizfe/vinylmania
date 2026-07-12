import { type ReactNode, useState } from 'react';

import { Button } from '../ui/Button';
import { Card } from '../ui/Card';

interface CollapsibleFilterPanelProps {
  /** Total number of currently active/selected filter values across all fields (spec Edge Cases: shown as a plain count, not a list). */
  activeCount: number;
  children: ReactNode;
}

function CollapseIcon() {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      className="h-4 w-4"
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
 */
export function CollapsibleFilterPanel({
  activeCount,
  children,
}: CollapsibleFilterPanelProps) {
  const [expanded, setExpanded] = useState(false);

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
          {activeCount > 0 && (
            <span
              data-testid="active-filter-badge"
              aria-hidden="true"
              className="ml-2 inline-flex min-h-6 min-w-6 items-center justify-center rounded-full bg-primary px-1.5 text-xs font-semibold text-white"
            >
              {activeCount}
            </span>
          )}
        </Button>
      </Card>
    );
  }

  return (
    <Card padding="sm">
      <div className="mb-2 flex items-center justify-between gap-4">
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
          Filters
        </span>
        <Button
          type="button"
          variant="secondary"
          size="icon"
          aria-label="Collapse filters"
          onClick={() => setExpanded(false)}
        >
          <CollapseIcon />
        </Button>
      </div>
      {children}
    </Card>
  );
}
