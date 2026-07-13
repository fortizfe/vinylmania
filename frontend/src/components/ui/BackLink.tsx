import { Link } from 'react-router-dom';

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
      className="inline-flex min-h-11 items-center gap-1 text-sm font-medium text-stone-500 no-underline hover:text-stone-900 dark:text-stone-400 dark:hover:text-stone-100"
    >
      <ChevronLeftIcon />
      {label}
    </Link>
  );
}
