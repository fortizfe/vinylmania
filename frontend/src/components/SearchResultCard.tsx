import type { CatalogSearchResult } from '../services/discogsApi';
import { Badge } from './ui/Badge';
import { Card } from './ui/Card';
import { ResultCardActions } from './ResultCardActions';

interface SearchResultCardProps {
  result: CatalogSearchResult;
  onAdd: () => void;
  onPreview: () => void;
  adding: boolean;
  added: boolean;
}

export function SearchResultCard({
  result,
  onAdd,
  onPreview,
  adding,
  added,
}: SearchResultCardProps) {
  const format = result.formats?.[0];

  return (
    <Card padding="sm" className="flex flex-col gap-2">
      {result.thumbnailUrl ? (
        <img
          src={result.thumbnailUrl}
          alt={result.title}
          className="aspect-square w-full rounded-md object-cover"
        />
      ) : (
        <div
          data-testid="search-result-thumbnail-placeholder"
          className="aspect-square w-full rounded-md bg-gray-100 dark:bg-gray-800"
        />
      )}
      <span className="truncate font-semibold text-gray-900 dark:text-gray-100">
        {result.title}
      </span>
      {result.artist && (
        <span className="truncate text-sm text-gray-500 dark:text-gray-400">{result.artist}</span>
      )}
      <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
        {result.year && <span>{result.year}</span>}
        {format && <Badge tone="muted">{format}</Badge>}
      </div>
      <ResultCardActions onAdd={onAdd} onPreview={onPreview} adding={adding} added={added} />
    </Card>
  );
}
