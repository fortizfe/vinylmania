import { useRef } from 'react';

import type { EntryDiscogsData } from '../services/libraryApi';
import { Button } from './ui/Button';
import { InlineEditableField, type InlineEditableFieldHandle } from './ui/InlineEditableField';
import { StarRating } from './ui/StarRating';

/** Discogs grading vocabulary (R6). Must match backend conditionGrading.ts exactly. */
export const MEDIA_CONDITIONS = [
  'Mint (M)',
  'Near Mint (NM or M-)',
  'Very Good Plus (VG+)',
  'Very Good (VG)',
  'Good Plus (G+)',
  'Good (G)',
  'Fair (F)',
  'Poor (P)',
] as const;

export const SLEEVE_CONDITIONS = [
  ...MEDIA_CONDITIONS,
  'Generic',
  'Not Graded',
  'No Cover',
] as const;

const fieldClasses =
  'rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-primary focus:outline-none dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 disabled:opacity-50 disabled:cursor-not-allowed';
const labelClasses = 'text-sm font-medium text-gray-700 dark:text-gray-300';

interface MyCopySectionProps {
  discogs: EntryDiscogsData | null;
  onSaveRating: (rating: number) => Promise<void>;
  onSaveMediaCondition: (value: string | null) => Promise<void>;
  onSaveSleeveCondition: (value: string | null) => Promise<void>;
  onSaveNotes: (value: string) => Promise<void>;
  onRemove: () => void;
}

export function MyCopySection({
  discogs,
  onSaveRating,
  onSaveMediaCondition,
  onSaveSleeveCondition,
  onSaveNotes,
  onRemove,
}: MyCopySectionProps) {
  const notesFieldRef = useRef<InlineEditableFieldHandle>(null);

  const editable = discogs?.editable ?? { mediaCondition: false, sleeveCondition: false, notes: false };

  async function handleConditionChange(
    event: React.ChangeEvent<HTMLSelectElement>,
    save: (value: string | null) => Promise<void>,
  ) {
    const value = event.target.value;
    await save(value === '' ? null : value);
  }

  return (
    <div>
      <h2 className="mb-3 text-lg font-semibold text-gray-900 dark:text-gray-100">Your copy</h2>
      <div className="flex flex-col gap-4">
        {/* Rating */}
        <div className="flex flex-col gap-1">
          <span className={labelClasses}>Rating</span>
          <StarRating
            value={discogs?.rating ?? 0}
            onChange={onSaveRating}
            disabled={discogs === null}
          />
        </div>

        {/* Media Condition */}
        <div className="flex flex-col gap-1">
          <span className={labelClasses}>Media Condition</span>
          {!editable.mediaCondition && discogs !== null && (
            <p className="text-xs text-gray-400 dark:text-gray-500">
              The &ldquo;Media Condition&rdquo; field is not available on this collection.
            </p>
          )}
          <select
            aria-label="Media Condition"
            value={discogs?.mediaCondition ?? ''}
            onChange={(e) => handleConditionChange(e, onSaveMediaCondition)}
            disabled={!editable.mediaCondition || discogs === null}
            className={fieldClasses}
          >
            <option value="">—</option>
            {MEDIA_CONDITIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </div>

        {/* Sleeve Condition */}
        <div className="flex flex-col gap-1">
          <span className={labelClasses}>Sleeve Condition</span>
          {!editable.sleeveCondition && discogs !== null && (
            <p className="text-xs text-gray-400 dark:text-gray-500">
              The &ldquo;Sleeve Condition&rdquo; field is not available on this collection.
            </p>
          )}
          <select
            aria-label="Sleeve Condition"
            value={discogs?.sleeveCondition ?? ''}
            onChange={(e) => handleConditionChange(e, onSaveSleeveCondition)}
            disabled={!editable.sleeveCondition || discogs === null}
            className={fieldClasses}
          >
            <option value="">—</option>
            {SLEEVE_CONDITIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </div>

        {/* Notes */}
        <div className="flex flex-col gap-1">
          <span className={labelClasses}>Notes</span>
          {!editable.notes && discogs !== null && (
            <p className="text-xs text-gray-400 dark:text-gray-500">
              The &ldquo;Notes&rdquo; field is not available on this collection.
            </p>
          )}
          <InlineEditableField
            ref={notesFieldRef}
            value={discogs?.notes ?? ''}
            placeholder="Add notes"
            fieldLabel="Notes"
            disabled={!editable.notes || discogs === null}
            onSave={onSaveNotes}
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
          <Button variant="secondary" onClick={onRemove}>
            Remove from library
          </Button>
        </div>
      </div>
    </div>
  );
}

