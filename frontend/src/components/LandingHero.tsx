import { VinylmaniaIcon } from './brand/VinylmaniaIcon';
import { VinylmaniaWordmark } from './brand/VinylmaniaWordmark';

export function LandingHero() {
  return (
    <div className="flex max-w-2xl flex-col gap-3">
      <h1 className="flex flex-col items-center gap-3 text-stone-900 dark:text-stone-100 sm:items-start">
        <VinylmaniaIcon size={120} className="h-32 w-32" />
        <VinylmaniaWordmark className="text-4xl sm:text-6xl" grunge />
      </h1>
      <span
        aria-hidden="true"
        className="h-1 w-12 rounded-full bg-primary dark:bg-accent"
      />
      <p className="text-lg text-stone-500 sm:text-xl dark:text-stone-400">
        Track your collection with Discogs, rate every record, and follow curated rock and
        metal news — all in one place.
      </p>
    </div>
  );
}
