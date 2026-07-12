import clsx from 'clsx';

import type { Theme } from '../../theme/ThemeContext';

interface ThemeToggleProps {
  theme: Theme;
  onToggle: () => void;
  className?: string;
}

function SunArtwork() {
  return (
    <svg
      data-testid="theme-toggle-sun-artwork"
      viewBox="0 0 24 24"
      className="h-4 w-4 text-amber-500"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="4.5" fill="currentColor" />
      <g stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
        <path d="M12 2.5v2" />
        <path d="M12 19.5v2" />
        <path d="M4.2 4.2l1.4 1.4" />
        <path d="M18.4 18.4l1.4 1.4" />
        <path d="M2.5 12h2" />
        <path d="M19.5 12h2" />
        <path d="M4.2 19.8l1.4-1.4" />
        <path d="M18.4 5.6l1.4-1.4" />
      </g>
    </svg>
  );
}

function MoonArtwork() {
  return (
    <svg
      data-testid="theme-toggle-moon-artwork"
      viewBox="0 0 24 24"
      className="h-4 w-4 text-slate-100"
      aria-hidden="true"
    >
      <path
        d="M20 14.5A8.5 8.5 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5Z"
        fill="currentColor"
      />
    </svg>
  );
}

/**
 * A modern sun (blue sky + clouds) / moon (night sky + stars) switch for the
 * Preferences section (FR-003). Presentational only — theme resolution and
 * persistence live in the parent (ThemeContext / useThemePreference).
 */
export function ThemeToggle({ theme, onToggle, className }: ThemeToggleProps) {
  const isDark = theme === 'dark';

  return (
    <button
      type="button"
      role="switch"
      aria-checked={isDark}
      aria-label="Dark mode"
      onClick={onToggle}
      className={clsx(
        'relative inline-flex min-h-11 h-9 w-16 shrink-0 items-center overflow-hidden rounded-full border transition-colors duration-300 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2',
        isDark
          ? 'border-slate-700 bg-linear-to-b from-slate-800 to-slate-950'
          : 'border-sky-300 bg-linear-to-b from-sky-300 to-sky-500',
        className,
      )}
    >
      {/* Decorative sky elements (clouds / stars) */}
      <span
        className={clsx(
          'pointer-events-none absolute inset-0 transition-opacity duration-300',
          isDark ? 'opacity-0' : 'opacity-100',
        )}
        aria-hidden="true"
      >
        <span className="absolute left-2 top-2 h-1.5 w-3 rounded-full bg-white/80" />
        <span className="absolute left-4 top-4 h-1 w-2 rounded-full bg-white/70" />
      </span>
      <span
        className={clsx(
          'pointer-events-none absolute inset-0 transition-opacity duration-300',
          isDark ? 'opacity-100' : 'opacity-0',
        )}
        aria-hidden="true"
      >
        <span className="absolute left-2.5 top-2 h-0.5 w-0.5 rounded-full bg-white" />
        <span className="absolute left-4.5 top-5 h-0.5 w-0.5 rounded-full bg-white" />
        <span className="absolute left-3 top-6 h-px w-px rounded-full bg-white" />
      </span>

      <span
        className={clsx(
          'relative z-10 flex h-7 w-7 items-center justify-center rounded-full shadow-md transition-transform duration-300 ease-in-out',
          isDark ? 'translate-x-8 bg-slate-700' : 'translate-x-1 bg-white',
        )}
      >
        {isDark ? <MoonArtwork /> : <SunArtwork />}
      </span>
    </button>
  );
}
