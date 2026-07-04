import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import { DiscInfoCard } from '../components/DiscInfoCard';
import { RecordDetailSkeleton } from '../components/RecordDetailSkeleton';
import { RecordHeaderImage } from '../components/RecordHeaderImage';
import { TracklistCard } from '../components/TracklistCard';
import { BackLink } from '../components/ui/BackLink';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { InlineEditableField, type InlineEditableFieldHandle } from '../components/ui/InlineEditableField';
import * as libraryApi from '../services/libraryApi';
import type { EnrichedLibraryEntry } from '../services/libraryApi';

const CONDITION_OPTIONS = ['Mint', 'Near Mint', 'Very Good Plus', 'Good', 'Fair', 'Poor'];

const fieldClasses =
  'rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-primary focus:outline-none dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100';
const labelClasses = 'text-sm font-medium text-gray-700 dark:text-gray-300';

export function RecordDetailPage() {
  const { entryId } = useParams<{ entryId: string }>();
  const navigate = useNavigate();
  const [entry, setEntry] = useState<EnrichedLibraryEntry | null>(null);
  const [notFound, setNotFound] = useState(false);

  const conditionFieldRef = useRef<InlineEditableFieldHandle>(null);
  const notesFieldRef = useRef<InlineEditableFieldHandle>(null);

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

  async function saveCondition(newCondition: string) {
    if (!entryId) return;
    try {
      const updated = await libraryApi.update(entryId, newCondition);
      setEntry(updated);
    } catch (error) {
      console.error('Failed to save condition for library entry', entryId, error);
      throw error;
    }
  }

  async function saveNotes(newNotes: string) {
    if (!entryId) return;
    try {
      const updated = await libraryApi.update(entryId, undefined, newNotes);
      setEntry(updated);
    } catch (error) {
      console.error('Failed to save notes for library entry', entryId, error);
      throw error;
    }
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

  const yourCopyCard = (
    <Card>
      <h2 className="mb-3 text-lg font-semibold text-gray-900 dark:text-gray-100">Your copy</h2>
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <span className={labelClasses}>Condition</span>
          <InlineEditableField
            ref={conditionFieldRef}
            value={entry.condition ?? ''}
            placeholder="Add a condition"
            fieldLabel="Condition"
            onActivate={() => notesFieldRef.current?.commit()}
            onSave={saveCondition}
            renderEditor={({ value, onChange, onBlur, onKeyDown, autoFocus }) => (
              <select
                aria-label="Condition"
                value={value}
                onChange={(event) => onChange(event.target.value)}
                onBlur={onBlur}
                onKeyDown={onKeyDown}
                autoFocus={autoFocus}
                className={fieldClasses}
              >
                <option value="">—</option>
                {CONDITION_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            )}
          />
        </div>

        <div className="flex flex-col gap-1">
          <span className={labelClasses}>Notes</span>
          <InlineEditableField
            ref={notesFieldRef}
            value={entry.notes ?? ''}
            placeholder="Add notes"
            fieldLabel="Notes"
            onActivate={() => conditionFieldRef.current?.commit()}
            onSave={saveNotes}
            renderEditor={({ value, onChange, onBlur, onKeyDown, autoFocus }) => (
              <textarea
                aria-label="Notes"
                value={value}
                onChange={(event) => onChange(event.target.value)}
                onBlur={onBlur}
                onKeyDown={onKeyDown}
                autoFocus={autoFocus}
                className={fieldClasses}
              />
            )}
          />
        </div>

        <div className="flex gap-3">
          <Button variant="secondary" onClick={handleRemove}>
            Remove from library
          </Button>
        </div>
      </div>
    </Card>
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
        {yourCopyCard}
      </main>
    );
  }

  const { release } = entry;

  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-6 p-6 sm:p-8">
      <BackLink to="/app/library" />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="lg:col-span-2">
          <RecordHeaderImage images={release.images} alt={release.title} />
        </div>
        <div className="flex flex-col gap-6">
          <DiscInfoCard release={release} />
          {yourCopyCard}
        </div>
        <div>
          <TracklistCard tracks={release.tracklist} />
        </div>
      </div>
    </main>
  );
}
