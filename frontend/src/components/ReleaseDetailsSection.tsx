import { Badge } from './ui/Badge';
import type { Release } from '../services/libraryApi';

interface ReleaseDetailsSectionProps {
  release: Release;
}

function formatLabel(label: Release['labels'][number]): string {
  return label.catalogNumber ? `${label.name} (${label.catalogNumber})` : label.name;
}

function formatDescriptor(format: Release['formats'][number]): string {
  return format.descriptions.length > 0
    ? `${format.name} (${format.descriptions.join(', ')})`
    : format.name;
}

export function ReleaseDetailsSection({ release }: ReleaseDetailsSectionProps) {
  const hasMetaRow =
    release.country ||
    release.releaseDate ||
    release.formats.length > 0 ||
    release.labels.length > 0 ||
    release.genres.length > 0 ||
    release.styles.length > 0;

  return (
    <div className="flex flex-col gap-3">
      <div>
        {/*
          The record title is the page's single <h1> (contracts/ui-contracts.md
          §C7 — "page <h1> is the record title in ReleaseDetailsSection"),
          matching every other Vinylmania page which owns its own <h1>. Each
          detail card below is an <h2>, so the heading outline is
          h1 → h2 (rating) → h2 (streaming) → h2 (tracklist) → h2 (catalog)
          with no skipped level (WCAG 1.3.1). Only ReleaseDetailPage /
          RecordDetailPage render this component — the master page uses
          MasterReleaseDetailsSection, so its heading structure is untouched.
        */}
        <h1 className="font-display text-lg leading-display tracking-display text-stone-900 dark:text-stone-100">
          {release.title}
        </h1>
        {release.artists.map((artist) => (
          <p key={artist.discogsArtistId} className="text-stone-500 dark:text-stone-400">
            {artist.name}
          </p>
        ))}
      </div>

      {hasMetaRow && (
        <div className="flex flex-wrap items-center gap-2 text-sm text-stone-500 dark:text-stone-400">
          {release.country && <span>{release.country}</span>}
          {release.releaseDate && <span>{release.releaseDate}</span>}
          {release.formats.map((format) => (
            <Badge key={format.name} tone="muted">
              {formatDescriptor(format)}
            </Badge>
          ))}
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
