import type { MasterRelease } from '../services/discogsApi';

interface MasterReleaseDetailsSectionProps {
  master: MasterRelease;
}

/** Master's identity only (title/artist) — year/genres/styles live in `MasterReleaseOtherDetailsSection` instead (spec 057). */
export function MasterReleaseDetailsSection({ master }: MasterReleaseDetailsSectionProps) {
  return (
    <div>
      <h3 className="font-display text-lg leading-tight text-stone-900 dark:text-stone-100">
        {master.title}
      </h3>
      {master.artists.map((artist) => (
        <p key={artist.discogsArtistId} className="text-stone-500 dark:text-stone-400">
          {artist.name}
        </p>
      ))}
    </div>
  );
}
