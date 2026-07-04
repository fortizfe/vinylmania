import { Badge } from './ui/Badge';
import { Card } from './ui/Card';
import type { Release } from '../services/libraryApi';

interface DiscInfoCardProps {
  release: Release;
}

function formatDescriptor(format: Release['formats'][number]): string {
  return format.descriptions.length > 0
    ? `${format.name} (${format.descriptions.join(', ')})`
    : format.name;
}

export function DiscInfoCard({ release }: DiscInfoCardProps) {
  const artistNames = release.artists.map((artist) => artist.name).join(', ');

  return (
    <Card>
      <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">{release.title}</h1>
      {artistNames.length > 0 && <p className="text-gray-500 dark:text-gray-400">{artistNames}</p>}

      <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
        {release.year && <span>{release.year}</span>}
        {release.formats.map((format) => (
          <Badge key={format.name} tone="muted">
            {formatDescriptor(format)}
          </Badge>
        ))}
        {release.genres.map((genre) => (
          <Badge key={genre}>{genre}</Badge>
        ))}
      </div>
    </Card>
  );
}
