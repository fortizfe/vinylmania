import clsx from 'clsx';

import { useScrolledPast } from '../hooks/useScrolledPast';
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
  const scrolled = useScrolledPast();

  return (
    <header
      className={clsx(
        'sticky top-0 z-40 flex w-full items-center justify-between gap-4 bg-white px-4 py-4 transition-shadow duration-(--motion-duration-fade) ease-out dark:bg-surface sm:px-6',
        scrolled && 'header-scroll-edge',
      )}
    >
      <div className="flex min-w-0 items-center gap-2 text-stone-900 dark:text-stone-100">
        <VinylmaniaIcon size={36} className="h-9 w-9" />
        <VinylmaniaWordmark className="truncate text-xl" />
      </div>
      <GoogleSignInButton onClick={onClick} loading={loading} error={error} />
    </header>
  );
}
