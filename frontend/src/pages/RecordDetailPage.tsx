import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import * as libraryApi from '../services/libraryApi';
import type { EnrichedLibraryEntry } from '../services/libraryApi';

const CONDITION_OPTIONS = ['Mint', 'Near Mint', 'Very Good Plus', 'Good', 'Fair', 'Poor'];

export function RecordDetailPage() {
  const { entryId } = useParams<{ entryId: string }>();
  const navigate = useNavigate();
  const [entry, setEntry] = useState<EnrichedLibraryEntry | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [conditionInput, setConditionInput] = useState('');
  const [notesInput, setNotesInput] = useState('');

  useEffect(() => {
    if (!entryId) return;
    let cancelled = false;

    libraryApi
      .getOne(entryId)
      .then((result) => {
        if (!cancelled) setEntry(result);
      })
      .catch(() => {
        if (!cancelled) setNotFound(true);
      });

    return () => {
      cancelled = true;
    };
  }, [entryId]);

  async function handleRemove() {
    if (!entryId) return;
    if (!window.confirm('Remove this record from your library? This cannot be undone.')) {
      return;
    }
    await libraryApi.remove(entryId);
    navigate('/app');
  }

  function startEditing() {
    setConditionInput(entry?.condition ?? '');
    setNotesInput(entry?.notes ?? '');
    setIsEditing(true);
  }

  async function handleSave() {
    if (!entryId) return;
    const updated = await libraryApi.update(
      entryId,
      conditionInput || undefined,
      notesInput || undefined,
    );
    setEntry(updated);
    setIsEditing(false);
  }

  if (notFound) {
    return (
      <main className="app-page">
        <p>Couldn&apos;t find that record in your library.</p>
      </main>
    );
  }

  if (!entry) {
    return (
      <main className="app-page">
        <p>Loading…</p>
      </main>
    );
  }

  const yourCopy = isEditing ? (
    <div>
      <label htmlFor="record-condition">Condition</label>
      <select
        id="record-condition"
        value={conditionInput}
        onChange={(event) => setConditionInput(event.target.value)}
      >
        <option value="">—</option>
        {CONDITION_OPTIONS.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>

      <label htmlFor="record-notes">Notes</label>
      <textarea
        id="record-notes"
        value={notesInput}
        onChange={(event) => setNotesInput(event.target.value)}
      />

      <button type="button" onClick={handleSave}>
        Save
      </button>
      <button type="button" onClick={() => setIsEditing(false)}>
        Cancel
      </button>
    </div>
  ) : (
    <div>
      {entry.condition && <p>Condition: {entry.condition}</p>}
      {entry.notes && <p>Notes: {entry.notes}</p>}
      <button type="button" onClick={startEditing}>
        Edit
      </button>
      <button type="button" onClick={handleRemove}>
        Remove from library
      </button>
    </div>
  );

  if (entry.catalogStatus === 'unavailable' || !entry.release) {
    return (
      <main className="app-page">
        <p>Couldn&apos;t load catalog details for this record right now.</p>
        {yourCopy}
      </main>
    );
  }

  const { release } = entry;

  return (
    <main className="app-page">
      <h1>{release.title}</h1>
      {release.artists.map((artist) => (
        <p key={artist.discogsArtistId}>{artist.name}</p>
      ))}

      {release.tracklist.length > 0 && (
        <>
          <h2>Tracklist</h2>
          <ol>
            {release.tracklist.map((track) => (
              <li key={`${track.position}-${track.title}`}>
                {track.position}. {track.title}
                {track.duration && ` (${track.duration})`}
              </li>
            ))}
          </ol>
        </>
      )}

      <h2>Your copy</h2>
      {yourCopy}
    </main>
  );
}
