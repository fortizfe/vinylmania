import type { KeyboardEvent, ReactNode } from 'react';
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import clsx from 'clsx';

export interface InlineEditableFieldHandle {
  /** Saves the current in-progress edit, if any, as if the field had lost focus. */
  commit: () => void;
}

interface EditorRenderProps {
  value: string;
  onChange: (value: string) => void;
  onBlur: () => void;
  onKeyDown: (event: KeyboardEvent<HTMLElement>) => void;
  autoFocus: boolean;
}

interface InlineEditableFieldProps {
  value: string;
  placeholder: string;
  fieldLabel: string;
  renderEditor: (props: EditorRenderProps) => ReactNode;
  onSave: (value: string) => Promise<void>;
  onActivate?: () => void;
  /** When true, the field shows its value but cannot be activated for editing. */
  disabled?: boolean;
}

type Mode = 'read' | 'editing' | 'saving' | 'saved' | 'error';

export const InlineEditableField = forwardRef<
  InlineEditableFieldHandle,
  InlineEditableFieldProps
>(function InlineEditableField(
  { value, placeholder, fieldLabel, renderEditor, onSave, onActivate, disabled = false },
  ref,
) {
  const [mode, setMode] = useState<Mode>('read');
  const [savedValue, setSavedValue] = useState(value);
  const [draftValue, setDraftValue] = useState(value);
  const savedTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (mode === 'read') {
      setSavedValue(value);
    }
  }, [value, mode]);

  useEffect(() => {
    return () => {
      if (savedTimeoutRef.current) clearTimeout(savedTimeoutRef.current);
    };
  }, []);

  function startEditing() {
    if (disabled) return;
    setDraftValue(savedValue);
    setMode('editing');
    onActivate?.();
  }

  async function commit() {
    if (mode !== 'editing' && mode !== 'error') return;

    if (draftValue === savedValue) {
      setMode('read');
      return;
    }

    setMode('saving');
    try {
      await onSave(draftValue);
      setSavedValue(draftValue);
      setMode('saved');
      savedTimeoutRef.current = setTimeout(() => setMode('read'), 1500);
    } catch {
      setMode('error');
    }
  }

  function cancel() {
    setDraftValue(savedValue);
    setMode('read');
  }

  useImperativeHandle(ref, () => ({ commit }));

  function handleKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.key === 'Escape') {
      event.preventDefault();
      cancel();
    }
  }

  if (mode === 'read' || mode === 'saved') {
    const displayText = savedValue || placeholder;
    return (
      <button
        type="button"
        onClick={startEditing}
        aria-label={`Edit ${fieldLabel}`}
        className={clsx(
          'flex min-h-11 items-center gap-2 rounded-md px-1 py-0.5 text-left transition-colors',
          'hover:bg-stone-100 dark:hover:bg-stone-900',
          '[@media(hover:none)]:bg-stone-50 [@media(hover:none)]:dark:bg-stone-900/60',
          !savedValue && 'italic text-stone-400 dark:text-stone-500',
        )}
      >
        <span className="text-stone-700 dark:text-stone-300">{displayText}</span>
        {mode === 'saved' && (
          <output className="text-xs font-medium text-green-600 dark:text-green-400">
            Saved
          </output>
        )}
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      {renderEditor({
        value: draftValue,
        onChange: setDraftValue,
        onBlur: commit,
        onKeyDown: handleKeyDown,
        autoFocus: true,
      })}
      {mode === 'saving' && (
        <span className="text-xs text-stone-500 dark:text-stone-400">Saving…</span>
      )}
      {mode === 'error' && (
        <span className="text-xs text-red-600 dark:text-red-400" role="alert">
          Couldn&apos;t save — check your connection and try again.
        </span>
      )}
    </div>
  );
});
