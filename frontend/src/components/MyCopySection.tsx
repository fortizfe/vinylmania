import { useRef } from 'react';

import { Button } from './ui/Button';
import { InlineEditableField, type InlineEditableFieldHandle } from './ui/InlineEditableField';

const CONDITION_OPTIONS = ['Mint', 'Near Mint', 'Very Good Plus', 'Good', 'Fair', 'Poor'];

const fieldClasses =
  'rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-primary focus:outline-none dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100';
const labelClasses = 'text-sm font-medium text-gray-700 dark:text-gray-300';

interface MyCopySectionProps {
  condition?: string;
  notes?: string;
  onSaveCondition: (value: string) => Promise<void>;
  onSaveNotes: (value: string) => Promise<void>;
  onRemove: () => void;
}

export function MyCopySection({
  condition,
  notes,
  onSaveCondition,
  onSaveNotes,
  onRemove,
}: MyCopySectionProps) {
  const conditionFieldRef = useRef<InlineEditableFieldHandle>(null);
  const notesFieldRef = useRef<InlineEditableFieldHandle>(null);

  return (
    <div>
      <h2 className="mb-3 text-lg font-semibold text-gray-900 dark:text-gray-100">Your copy</h2>
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <span className={labelClasses}>Condition</span>
          <InlineEditableField
            ref={conditionFieldRef}
            value={condition ?? ''}
            placeholder="Add a condition"
            fieldLabel="Condition"
            onActivate={() => notesFieldRef.current?.commit()}
            onSave={onSaveCondition}
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
            value={notes ?? ''}
            placeholder="Add notes"
            fieldLabel="Notes"
            onActivate={() => conditionFieldRef.current?.commit()}
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
