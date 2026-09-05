import { useLayoutEffect, useRef, useState } from 'react';
import type { KeyboardEvent, ReactElement } from 'react';
import clsx from 'clsx';

import { m, spring, usePrefersReducedMotion } from '../../motion';
import type { ViewMode } from '../../hooks/useViewModePreference';
import { focusRing } from './focusRing';
import { pressable } from './press';

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

interface PillRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Two named, equally-weighted alternatives (not a binary on/off), so this
 * uses the WAI-ARIA radio-group pattern rather than ThemeToggle's
 * role="switch" (research.md R2): roving tabIndex, arrow keys move focus
 * and selection between the two options.
 *
 * The active-option background is a single shared "pill" (`m.div`) that
 * slides between the two options on `spring.default` instead of the colour
 * snapping from one button to the other (US2 / contracts §ViewModeToggle).
 * Its target rect is measured from the live buttons — a plain transform
 * animation, so it works under the app's `domAnimation` feature bundle and
 * needs no `layout` projection. Under `prefers-reduced-motion` the pill
 * jumps (no spring).
 */
export function ViewModeToggle({ mode, onChange, screen }: ViewModeToggleProps) {
  const reduceMotion = usePrefersReducedMotion();
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRefs = useRef<Partial<Record<ViewMode, HTMLButtonElement | null>>>({});
  const [pill, setPill] = useState<PillRect | null>(null);

  useLayoutEffect(() => {
    function measure() {
      const container = containerRef.current;
      const active = buttonRefs.current[mode];
      if (!container || !active) return;
      const c = container.getBoundingClientRect();
      const a = active.getBoundingClientRect();
      setPill({
        x: a.left - c.left,
        y: a.top - c.top,
        width: a.width,
        height: a.height,
      });
    }

    measure();

    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(measure);
    if (containerRef.current) observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [mode]);

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
    event.preventDefault();
    const other = OPTIONS.find((option) => option.mode !== mode)!;
    onChange(other.mode);
  }

  return (
    <div
      ref={containerRef}
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
      className="relative inline-flex gap-1 rounded-xl border border-stone-500 p-1"
    >
      {pill && (
        <m.div
          data-testid="view-mode-pill"
          data-reduced-motion={reduceMotion ? 'true' : 'false'}
          aria-hidden="true"
          className="pointer-events-none absolute left-0 top-0 z-0 rounded-lg bg-primary"
          initial={false}
          animate={{ x: pill.x, y: pill.y, width: pill.width, height: pill.height }}
          transition={reduceMotion ? { duration: 0 } : spring.default}
        />
      )}
      {OPTIONS.map(({ mode: optionMode, label, icon: Icon }) => {
        const isActive = optionMode === mode;
        return (
          <button
            key={optionMode}
            ref={(node) => {
              buttonRefs.current[optionMode] = node;
            }}
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
              'relative z-10 inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg',
              focusRing,
              pressable,
              isActive
                ? 'text-white'
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
