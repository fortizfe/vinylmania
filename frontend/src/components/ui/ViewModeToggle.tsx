import type { KeyboardEvent, ReactElement } from 'react';
import clsx from 'clsx';

import type { ViewMode } from '../../hooks/useViewModePreference';

interface ViewModeToggleProps {
  mode: ViewMode;
  onChange: (mode: ViewMode) => void;
  /** Distinguishes the two independent instances for aria-label scoping. */
  screen: 'search' | 'library';
}

function GridIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4" aria-hidden="true">
      <rect x="2" y="2" width="7" height="7" rx="1" />
      <rect x="11" y="2" width="7" height="7" rx="1" />
      <rect x="2" y="11" width="7" height="7" rx="1" />
      <rect x="11" y="11" width="7" height="7" rx="1" />
    </svg>
  );
}

function ListIcon() {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      className="h-4 w-4"
      aria-hidden="true"
    >
      <path d="M4 5h12" />
      <path d="M4 10h12" />
      <path d="M4 15h12" />
    </svg>
  );
}

const OPTIONS: { mode: ViewMode; label: string; icon: () => ReactElement }[] = [
  { mode: 'grid', label: 'Grid view', icon: GridIcon },
  { mode: 'list', label: 'List view', icon: ListIcon },
];

/**
 * Two named, equally-weighted alternatives (not a binary on/off), so this
 * uses the WAI-ARIA radio-group pattern rather than ThemeToggle's
 * role="switch" (research.md R2): roving tabIndex, arrow keys move focus
 * and selection between the two options.
 */
export function ViewModeToggle({ mode, onChange, screen }: ViewModeToggleProps) {
  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
    event.preventDefault();
    const other = OPTIONS.find((option) => option.mode !== mode)!;
    onChange(other.mode);
  }

  return (
    <div
      role="radiogroup"
      aria-label="View mode"
      data-testid="view-mode-toggle"
      // border-stone-500 (not the lighter default border-stone-300)
      // against the app shell: at border-stone-300 this measured 1.49:1
      // (light), under the WCAG AA 3:1 minimum for UI component boundaries
      // (1.4.11) — see specs/058-theme-wcag-aa-refactor. border-stone-500
      // measures ~4.80:1 against the light (white) app shell and ~4.09:1
      // against the dark app shell, so one value replaces both the old
      // light default and the `dark:border-border-dark` override.
      className="inline-flex gap-1 rounded-xl border border-stone-500 p-1"
    >
      {OPTIONS.map(({ mode: optionMode, label, icon: Icon }) => {
        const isActive = optionMode === mode;
        return (
          <button
            key={optionMode}
            type="button"
            role="radio"
            aria-checked={isActive}
            aria-label={label}
            data-testid={`view-mode-${optionMode}`}
            tabIndex={isActive ? 0 : -1}
            onKeyDown={handleKeyDown}
            onClick={() => {
              if (!isActive) onChange(optionMode);
            }}
            className={clsx(
              'inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2',
              isActive
                ? 'bg-primary text-white'
                : 'text-stone-500 hover:bg-stone-100 dark:text-stone-400 dark:hover:bg-stone-900',
            )}
            data-view-mode-screen={screen}
          >
            <Icon />
          </button>
        );
      })}
    </div>
  );
}
