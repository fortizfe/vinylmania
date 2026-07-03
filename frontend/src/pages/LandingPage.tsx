import { Navigate } from 'react-router-dom';

import { GoogleSignInButton } from '../components/GoogleSignInButton';
import { LandingHero } from '../components/LandingHero';
import { useAuth } from '../auth/AuthContext';

export function LandingPage() {
  const { user, loading, signingIn, error, signIn } = useAuth();

  if (!loading && user) {
    return <Navigate to="/app" replace />;
  }

  return (
    <main className="landing-viewport" data-testid="landing-viewport">
      <LandingHero />
      <GoogleSignInButton onClick={signIn} loading={signingIn} error={error} />
    </main>
  );
}
