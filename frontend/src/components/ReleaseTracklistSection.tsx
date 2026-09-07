import type { Track } from '../services/libraryApi';

interface ReleaseTracklistSectionProps {
  tracklist: Track[];
}

export function ReleaseTracklistSection({ tracklist }: ReleaseTracklistSectionProps) {
  if (tracklist.length === 0) return null;

  return (
    <div>
      {/*
        <h2>: on the record-detail views every content card carries an <h2>
        under the page <h1> (contracts/ui-contracts.md §C7, no skipped level).
        The master page keeps its own (unchanged) heading structure — a later
        <h2> after its <h3> title is allowed (only skipping a level *down*
        fails WCAG 1.3.1).
      */}
      <h2 className="mb-2 font-semibold text-stone-900 dark:text-stone-100">Tracklist</h2>
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
