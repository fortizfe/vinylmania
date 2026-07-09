import { Link } from 'react-router-dom';

import { useAuth } from '../auth/AuthContext';
import { HamburgerMenu } from './HamburgerMenu';
import { HeaderNavIcons } from './HeaderNavIcons';
import { HeaderSearchBox } from './HeaderSearchBox';
import { Button } from './ui/Button';

export function AppHeader() {
  const { signOut } = useAuth();

  return (
    <header className="sticky top-0 z-40 grid grid-cols-[1fr_auto_1fr] items-center gap-3 border-b border-gray-200 bg-white px-4 py-4 dark:border-gray-800 dark:bg-gray-950 sm:px-6">
      <Link
        to="/app"
        className="justify-self-start truncate text-lg font-semibold text-gray-900 no-underline dark:text-gray-100"
      >
        Vinylmania
      </Link>
      <HeaderSearchBox />
      <div className="flex items-center justify-self-end gap-2">
        <HeaderNavIcons />
        <HamburgerMenu />
        <Button variant="secondary" onClick={signOut}>
          Sign out
        </Button>
      </div>
    </header>
  );
}
