import { Badge } from './ui/Badge';
import type { MasterRelease } from '../services/discogsApi';

interface MasterReleaseDetailsSectionProps {
  master: MasterRelease;
}

/** Master-only fields, in the same compact layout style as `ReleaseDetailsSection` (spec FR-008, research Decision 5). */
export function MasterReleaseDetailsSection({
  master,
}: MasterReleaseDetailsSectionProps) {
  const hasMetaRow = master.year || master.genres.length > 0 || master.styles.length > 0;

  return (
    <div className="flex flex-col gap-3">
      <div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
          {master.title}
        </h3>
        {master.artists.map((artist) => (
          <p key={artist.discogsArtistId} className="text-gray-500 dark:text-gray-400">
            {artist.name}
          </p>
        ))}
      </div>

      {hasMetaRow && (
        <div className="flex flex-wrap items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
          {master.year && <span>{master.year}</span>}
          {master.genres.map((genre) => (
            <Badge key={genre}>{genre}</Badge>
          ))}
          {master.styles.map((style) => (
            <Badge key={style} tone="muted">
              {style}
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}
