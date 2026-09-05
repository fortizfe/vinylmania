import clsx from 'clsx';

import { m, spring } from '../../motion';
import type { Theme } from '../../theme/ThemeContext';
import { focusRing } from './focusRing';
import { pressable } from './press';

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
      className="h-4 w-4 text-stone-100"
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
        // `pressable` owns the track's `transform,filter,color,border-color`
        // transition (tokenized 130ms/ease-out) and the press scale. The
        // knob translate rides `spring.default` (US2); the sky/stars
        // crossfade uses the shared `--motion-duration-fade` + `ease-out`
        // tokens. `focusRing` is the shared indicator.
        'relative inline-flex min-h-11 h-9 w-16 shrink-0 items-center overflow-hidden rounded-full border',
        focusRing,
        pressable,
        // Light-state border is sky-600, not the sky-300 used in the fill
        // gradient — sky-300 measured only 1.60:1 against this switch's
        // `bg-stone-50` row surface (spec 058 WCAG audit), under the 3:1
        // minimum for UI component boundaries (1.4.11); sky-600 clears it
        // at ~3.92:1 while staying recognizably "sky" blue. The dark-state
        // border reuses `--color-border-dark`, fixed at the token level in
        // global.css.
        isDark
          ? 'border-border-dark bg-linear-to-b from-surface-raised to-surface'
          : 'border-sky-600 bg-linear-to-b from-sky-300 to-sky-500',
        className,
      )}
    >
      {/* Decorative sky elements (clouds / stars) */}
      <span
        className={clsx(
          'pointer-events-none absolute inset-0 transition-opacity duration-(--motion-duration-fade) ease-out',
          isDark ? 'opacity-0' : 'opacity-100',
        )}
        aria-hidden="true"
      >
        <span className="absolute left-2 top-2 h-1.5 w-3 rounded-full bg-white/80" />
        <span className="absolute left-4 top-4 h-1 w-2 rounded-full bg-white/70" />
      </span>
      <span
        className={clsx(
          'pointer-events-none absolute inset-0 transition-opacity duration-(--motion-duration-fade) ease-out',
          isDark ? 'opacity-100' : 'opacity-0',
        )}
        aria-hidden="true"
      >
        <span className="absolute left-2.5 top-2 h-0.5 w-0.5 rounded-full bg-white" />
        <span className="absolute left-4.5 top-5 h-0.5 w-0.5 rounded-full bg-white" />
        <span className="absolute left-3 top-6 h-px w-px rounded-full bg-white" />
      </span>

      <m.span
        initial={false}
        animate={{ x: isDark ? 32 : 4 }}
        transition={spring.default}
        className={clsx(
          'relative z-10 flex h-7 w-7 items-center justify-center rounded-full shadow-md',
          isDark ? 'bg-stone-700' : 'bg-white',
        )}
      >
        {isDark ? <MoonArtwork /> : <SunArtwork />}
      </m.span>
    </button>
  );
}
