import { Link } from 'react-router-dom';

import { useAuth } from '../auth/AuthContext';
import { HamburgerMenu } from './HamburgerMenu';
import { Button } from './ui/Button';

export function AppHeader() {
  const { signOut } = useAuth();

  return (
    <header className="flex items-center justify-between border-b border-gray-200 px-4 py-4 dark:border-gray-800 sm:px-6">
      <Link to="/app" className="text-lg font-semibold text-gray-900 no-underline dark:text-gray-100">
        Vinylmania
      </Link>
      <div className="flex items-center gap-2">
        <HamburgerMenu />
        <Button variant="secondary" onClick={signOut}>
          Sign out
        </Button>
      </div>
    </header>
  );
}
