import { VinylmaniaIcon } from './brand/VinylmaniaIcon';
import { VinylmaniaWordmark } from './brand/VinylmaniaWordmark';
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
      <div className="flex min-w-0 items-center gap-2 text-gray-900 dark:text-gray-100">
        <VinylmaniaIcon size={36} className="h-9 w-9" />
        <VinylmaniaWordmark className="truncate text-xl" />
      </div>
      <GoogleSignInButton onClick={onClick} loading={loading} error={error} />
    </header>
  );
}
