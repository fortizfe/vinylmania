import type { Release } from '../services/libraryApi';
import { Modal } from './ui/Modal';
import { Skeleton } from './ui/Skeleton';

interface ReleasePreviewModalProps {
  open: boolean;
  onClose: () => void;
  release: Release | null;
  loading: boolean;
}

export function ReleasePreviewModal({ open, onClose, release, loading }: ReleasePreviewModalProps) {
  return (
    <Modal open={open} onClose={onClose} title="Preview">
      {loading && (
        <div data-testid="release-preview-loading" className="flex flex-col gap-3">
          <Skeleton className="aspect-square w-full" />
          <Skeleton className="h-5 w-2/3" />
          <Skeleton className="h-4 w-1/3" />
        </div>
      )}

      {!loading && !release && (
        <p className="text-gray-500 dark:text-gray-400">
          Couldn&apos;t load catalog details for this record right now.
        </p>
      )}

      {!loading && release && (
        <div className="flex flex-col gap-4">
          {release.images[0]?.url && (
            <img
              src={release.images[0].url}
              alt={release.title}
              className="aspect-square w-full rounded-md object-cover"
            />
          )}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              {release.title}
            </h3>
            {release.artists.map((artist) => (
              <p key={artist.discogsArtistId} className="text-gray-500 dark:text-gray-400">
                {artist.name}
              </p>
            ))}
          </div>

          {release.tracklist.length > 0 && (
            <div>
              <h4 className="mb-2 font-semibold text-gray-900 dark:text-gray-100">Tracklist</h4>
              <ol className="flex flex-col gap-1 text-sm text-gray-700 dark:text-gray-300">
                {release.tracklist.map((track) => (
                  <li key={`${track.position}-${track.title}`}>
                    {track.position}. {track.title}
                    {track.duration && ` (${track.duration})`}
                  </li>
                ))}
              </ol>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}
