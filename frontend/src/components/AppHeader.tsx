import { Link } from 'react-router-dom';

import { useAuth } from '../auth/AuthContext';
import { VinylmaniaIcon } from './brand/VinylmaniaIcon';
import { VinylmaniaWordmark } from './brand/VinylmaniaWordmark';
import { HamburgerMenu } from './HamburgerMenu';
import { HeaderNavIcons } from './HeaderNavIcons';
import { HeaderSearchBox } from './HeaderSearchBox';
import { Button } from './ui/Button';

export function AppHeader() {
  const { signOut } = useAuth();

  return (
    <header className="sticky top-0 z-40 grid grid-cols-[1fr_auto_1fr] items-center gap-3 border-b border-stone-200 bg-white px-4 py-4 dark:border-border-dark dark:bg-surface-raised sm:px-6">
      <Link
        to="/app"
        aria-label="Vinylmania"
        className="flex min-h-11 min-w-11 items-center justify-self-start gap-2 text-stone-900 no-underline dark:text-stone-100"
      >
        <VinylmaniaIcon size={28} className="h-7 w-7 md:h-9 md:w-9" />
        <VinylmaniaWordmark className="hidden text-xl md:inline-block" />
      </Link>
      <HeaderSearchBox />
      <div className="flex items-center justify-self-end gap-2">
        <HeaderNavIcons />
        <HamburgerMenu onSignOut={signOut} />
        <Button variant="secondary" onClick={signOut} className="hidden md:inline-flex">
          Sign out
        </Button>
      </div>
    </header>
  );
}
