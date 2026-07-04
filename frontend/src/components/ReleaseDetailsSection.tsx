import { Badge } from './ui/Badge';
import type { Release } from '../services/libraryApi';

interface ReleaseDetailsSectionProps {
  release: Release;
}

function formatLabel(label: Release['labels'][number]): string {
  return label.catalogNumber ? `${label.name} (${label.catalogNumber})` : label.name;
}

export function ReleaseDetailsSection({ release }: ReleaseDetailsSectionProps) {
  const hasMetaRow =
    release.country ||
    release.releaseDate ||
    release.labels.length > 0 ||
    release.genres.length > 0 ||
    release.styles.length > 0;

  return (
    <div className="flex flex-col gap-3">
      <div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{release.title}</h3>
        {release.artists.map((artist) => (
          <p key={artist.discogsArtistId} className="text-gray-500 dark:text-gray-400">
            {artist.name}
          </p>
        ))}
      </div>

      {hasMetaRow && (
        <div className="flex flex-wrap items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
          {release.country && <span>{release.country}</span>}
          {release.releaseDate && <span>{release.releaseDate}</span>}
          {release.labels.map((label) => (
            <Badge key={label.discogsLabelId} tone="muted">
              {formatLabel(label)}
            </Badge>
          ))}
          {release.genres.map((genre) => (
            <Badge key={genre}>{genre}</Badge>
          ))}
          {release.styles.map((style) => (
            <Badge key={style} tone="muted">
              {style}
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}
