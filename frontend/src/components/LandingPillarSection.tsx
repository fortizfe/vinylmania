import type { ReactNode } from 'react';

interface LandingPillarSectionProps {
  icon: ReactNode;
  title: string;
  description: string;
}

export function LandingPillarSection({
  icon,
  title,
  description,
}: LandingPillarSectionProps) {
  return (
    <section className="flex w-full max-w-md flex-col items-center gap-3 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary dark:bg-landing-accent/10 dark:text-landing-accent">
        {icon}
      </span>
      <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">{title}</h2>
      <p className="text-base text-gray-500 dark:text-gray-400">{description}</p>
    </section>
  );
}
