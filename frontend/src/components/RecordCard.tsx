import { Link } from 'react-router-dom';

import type { EnrichedLibraryEntry } from '../services/libraryApi';

interface RecordCardProps {
  entry: EnrichedLibraryEntry;
}

export function RecordCard({ entry }: RecordCardProps) {
  if (entry.catalogStatus === 'unavailable' || !entry.release) {
    return (
      <li className="record-card record-card--unavailable">
        <p>Couldn&apos;t load catalog details for this record right now.</p>
        {entry.condition && <p>Condition: {entry.condition}</p>}
      </li>
    );
  }

  const { release } = entry;
  const primaryArtist = release.artists[0]?.name;
  const cover = release.images[0]?.url;

  return (
    <li className="record-card">
      <Link to={`/app/records/${entry.id}`}>
        {cover && <img src={cover} alt="" className="record-card__cover" />}
        <span className="record-card__title">{release.title}</span>
        {primaryArtist && <span className="record-card__artist">{primaryArtist}</span>}
      </Link>
      {entry.condition && <span className="record-card__condition">{entry.condition}</span>}
    </li>
  );
}
