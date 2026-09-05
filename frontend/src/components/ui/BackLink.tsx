import { Link } from 'react-router-dom';
import clsx from 'clsx';

import { focusRing } from './focusRing';
import { pressableNudge } from './press';

interface BackLinkProps {
  to: string;
  label?: string;
}

function ChevronLeftIcon() {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      className="h-4 w-4"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4l-6 6 6 6" />
    </svg>
  );
}

export function BackLink({ to, label = 'Back' }: BackLinkProps) {
  return (
    <Link
      to={to}
      className={clsx(
        'inline-flex min-h-11 items-center gap-1 rounded-md text-sm font-medium text-stone-500 no-underline hover:text-stone-900 dark:text-stone-400 dark:hover:text-stone-100',
        focusRing,
        // Press nudges the whole control 2px toward the chevron — the "go
        // back" direction — instead of a scale (spec 059 US1 / audit).
        pressableNudge,
      )}
    >
      <ChevronLeftIcon />
      {label}
    </Link>
  );
}
