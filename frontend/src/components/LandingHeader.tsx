import { GoogleSignInButton } from './GoogleSignInButton';

interface LandingHeaderProps {
  onClick: () => void;
  loading?: boolean;
  error?: string | null;
}

export function LandingHeader({
  onClick,
  loading = false,
  error = null,
}: LandingHeaderProps) {
  return (
    <header className="sticky top-0 z-40 flex w-full items-center justify-between gap-4 border-b border-gray-200 bg-white px-4 py-4 dark:border-gray-800 dark:bg-landing-surface sm:px-6">
      <span className="truncate text-lg font-semibold text-gray-900 dark:text-gray-100">
        Vinylmania
      </span>
      <GoogleSignInButton onClick={onClick} loading={loading} error={error} />
    </header>
  );
}
