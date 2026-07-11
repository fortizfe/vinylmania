export function LandingHero() {
  return (
    <div className="flex max-w-2xl flex-col gap-3">
      <h1 className="text-4xl font-semibold tracking-tight text-gray-900 sm:text-6xl dark:text-gray-100">
        Vinylmania
      </h1>
      <span
        aria-hidden="true"
        className="h-1 w-12 rounded-full bg-primary dark:bg-landing-accent"
      />
      <p className="text-lg text-gray-500 sm:text-xl dark:text-gray-400">
        Track your collection with Discogs, rate every record, and follow curated rock and
        metal news — all in one place.
      </p>
    </div>
  );
}
