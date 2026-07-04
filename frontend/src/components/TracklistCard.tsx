import { Card } from './ui/Card';
import type { Track } from '../services/libraryApi';

interface TracklistCardProps {
  tracks: Track[];
}

export function TracklistCard({ tracks }: TracklistCardProps) {
  return (
    <Card>
      <h2 className="mb-3 text-lg font-semibold text-gray-900 dark:text-gray-100">Tracklist</h2>
      {tracks.length === 0 ? (
        <p className="text-gray-500 dark:text-gray-400">No tracklist available.</p>
      ) : (
        <ol className="flex flex-col gap-1 text-gray-700 dark:text-gray-300">
          {tracks.map((track) => (
            <li key={`${track.position}-${track.title}`}>
              {track.position}. {track.title}
              {track.duration && ` (${track.duration})`}
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
}
