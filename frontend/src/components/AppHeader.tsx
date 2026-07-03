import { Link } from 'react-router-dom';

import { useAuth } from '../auth/AuthContext';

export function AppHeader() {
  const { signOut } = useAuth();

  return (
    <header className="app-header">
      <Link to="/app" className="app-header__brand">
        Vinylmania
      </Link>
      <button type="button" onClick={signOut}>
        Sign out
      </button>
    </header>
  );
}
