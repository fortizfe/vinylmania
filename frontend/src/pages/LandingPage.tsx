import { Navigate } from 'react-router-dom';

import { LandingHeader } from '../components/LandingHeader';
import { LandingHero } from '../components/LandingHero';
import { LandingPillarSection } from '../components/LandingPillarSection';
import { CatalogIcon, NewsIcon, RatingIcon } from '../components/landingPillarIcons';
import { useAuth } from '../auth/AuthContext';

const PILLAR_SECTIONS = [
  {
    id: 'catalog',
    icon: <CatalogIcon />,
    title: 'Your catalog, powered by Discogs',
    description:
      'Every release is backed by Discogs metadata — accurate, always up to date.',
  },
  {
    id: 'ratings',
    icon: <RatingIcon />,
    title: 'Personal ratings for every record',
    description: 'Score the records you love and keep track of your favorites over time.',
  },
  {
    id: 'news',
    icon: <NewsIcon />,
    title: 'Curated rock and metal news',
    description:
      'Stay current with hand-picked rock and metal stories from trusted sources.',
  },
] as const;

export function LandingPage() {
  const { user, loading, error, signIn } = useAuth();

  if (!loading && user) {
    return <Navigate to="/app" replace />;
  }

  return (
    <div
      data-testid="landing-viewport"
      className="flex min-h-dvh w-full flex-col bg-white dark:bg-surface"
    >
      <LandingHeader onClick={signIn} error={error} />
      <main className="flex flex-1 flex-col items-center gap-16 p-6 text-center sm:gap-20 sm:p-12">
        <LandingHero />
        <div
          data-testid="landing-pillar-grid"
          className="grid w-full max-w-4xl grid-cols-1 gap-12 sm:grid-cols-3 sm:gap-8 lg:max-w-5xl xl:max-w-6xl xl:gap-16"
        >
          {PILLAR_SECTIONS.map((pillar) => (
            <LandingPillarSection
              key={pillar.id}
              icon={pillar.icon}
              title={pillar.title}
              description={pillar.description}
            />
          ))}
        </div>
      </main>
    </div>
  );
}
