import type { Track } from '../services/libraryApi';

interface ReleaseTracklistSectionProps {
  tracklist: Track[];
}

export function ReleaseTracklistSection({ tracklist }: ReleaseTracklistSectionProps) {
  if (tracklist.length === 0) return null;

  return (
    <div>
      <h4 className="mb-2 font-semibold text-stone-900 dark:text-stone-100">Tracklist</h4>
      <ol className="flex flex-col gap-1 text-sm text-stone-700 dark:text-stone-300">
        {tracklist.map((track) => (
          <li key={`${track.position}-${track.title}`}>
            {track.position}. {track.title}
            {track.duration && ` (${track.duration})`}
          </li>
        ))}
      </ol>
    </div>
  );
}
