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
    <main
      data-testid="landing-viewport"
      className="flex h-dvh w-full flex-col items-center justify-center gap-8 overflow-hidden p-6 text-center sm:gap-12 sm:p-12"
    >
      <LandingHero />
      <GoogleSignInButton onClick={signIn} loading={signingIn} error={error} />
    </main>
  );
}
