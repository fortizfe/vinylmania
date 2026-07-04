import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import { RecordDetailSkeleton } from '../components/RecordDetailSkeleton';
import { BackLink } from '../components/ui/BackLink';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
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
    navigate('/app/library');
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
      <main className="mx-auto flex max-w-2xl flex-col gap-6 p-6 sm:p-8">
        <BackLink to="/app/library" />
        <Card>
          <p className="text-gray-500 dark:text-gray-400">
            Couldn&apos;t find that record in your library.
          </p>
        </Card>
      </main>
    );
  }

  if (!entry) {
    return (
      <main className="mx-auto flex max-w-2xl flex-col gap-6 p-6 sm:p-8">
        <BackLink to="/app/library" />
        <RecordDetailSkeleton />
      </main>
    );
  }

  const fieldClasses =
    'rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-primary focus:outline-none dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100';
  const labelClasses = 'text-sm font-medium text-gray-700 dark:text-gray-300';

  const yourCopy = isEditing ? (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <label htmlFor="record-condition" className={labelClasses}>
          Condition
        </label>
        <select
          id="record-condition"
          value={conditionInput}
          onChange={(event) => setConditionInput(event.target.value)}
          className={fieldClasses}
        >
          <option value="">—</option>
          {CONDITION_OPTIONS.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="record-notes" className={labelClasses}>
          Notes
        </label>
        <textarea
          id="record-notes"
          value={notesInput}
          onChange={(event) => setNotesInput(event.target.value)}
          className={fieldClasses}
        />
      </div>

      <div className="flex gap-3">
        <Button onClick={handleSave}>Save</Button>
        <Button variant="secondary" onClick={() => setIsEditing(false)}>
          Cancel
        </Button>
      </div>
    </div>
  ) : (
    <div className="flex flex-col gap-3">
      {entry.condition && (
        <p className="text-gray-700 dark:text-gray-300">Condition: {entry.condition}</p>
      )}
      {entry.notes && <p className="text-gray-700 dark:text-gray-300">Notes: {entry.notes}</p>}
      <div className="flex gap-3">
        <Button variant="secondary" onClick={startEditing}>
          Edit
        </Button>
        <Button variant="secondary" onClick={handleRemove}>
          Remove from library
        </Button>
      </div>
    </div>
  );

  if (entry.catalogStatus === 'unavailable' || !entry.release) {
    return (
      <main className="mx-auto flex max-w-2xl flex-col gap-6 p-6 sm:p-8">
        <BackLink to="/app/library" />
        <Card>
          <p className="text-gray-500 dark:text-gray-400">
            Couldn&apos;t load catalog details for this record right now.
          </p>
        </Card>
        <Card>{yourCopy}</Card>
      </main>
    );
  }

  const { release } = entry;

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-6 p-6 sm:p-8">
      <BackLink to="/app/library" />
      <Card>
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
          {release.title}
        </h1>
        {release.artists.map((artist) => (
          <p key={artist.discogsArtistId} className="text-gray-500 dark:text-gray-400">
            {artist.name}
          </p>
        ))}
      </Card>

      {release.tracklist.length > 0 && (
        <Card>
          <h2 className="mb-3 text-lg font-semibold text-gray-900 dark:text-gray-100">
            Tracklist
          </h2>
          <ol className="flex flex-col gap-1 text-gray-700 dark:text-gray-300">
            {release.tracklist.map((track) => (
              <li key={`${track.position}-${track.title}`}>
                {track.position}. {track.title}
                {track.duration && ` (${track.duration})`}
              </li>
            ))}
          </ol>
        </Card>
      )}

      <Card>
        <h2 className="mb-3 text-lg font-semibold text-gray-900 dark:text-gray-100">Your copy</h2>
        {yourCopy}
      </Card>
    </main>
  );
}
