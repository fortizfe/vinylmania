import { Link } from 'react-router-dom';

interface BackLinkProps {
  to: string;
  label?: string;
}

function ChevronLeftIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4l-6 6 6 6" />
    </svg>
  );
}

export function BackLink({ to, label = 'Back' }: BackLinkProps) {
  return (
    <Link
      to={to}
      className="inline-flex items-center gap-1 text-sm font-medium text-gray-500 no-underline hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
    >
      <ChevronLeftIcon />
      {label}
    </Link>
  );
}
