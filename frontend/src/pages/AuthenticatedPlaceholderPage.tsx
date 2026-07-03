import { Navigate } from 'react-router-dom';

import { useAuth } from '../auth/AuthContext';

export function AuthenticatedPlaceholderPage() {
  const { user, loading, signOut } = useAuth();

  if (!loading && !user) {
    return <Navigate to="/" replace />;
  }

  if (!user) {
    return null;
  }

  return (
    <main className="authenticated-placeholder" data-testid="authenticated-placeholder">
      {user.photoURL && (
        <img
          className="authenticated-placeholder__avatar"
          src={user.photoURL}
          alt=""
          referrerPolicy="no-referrer"
        />
      )}
      <h1>You&apos;re signed in as {user.displayName}</h1>
      <p>The rest of Vinylmania is on its way — check back soon.</p>
      <button type="button" onClick={signOut}>
        Sign out
      </button>
    </main>
  );
}
