interface AppleMusicIconProps {
  /** Tailwind sizing/spacing classes. Defaults to the shared icon size. */
  className?: string;
}

/**
 * Beamed double-eighth-note glyph — the Apple Music mark (feature 062,
 * "Escúchalo en Streaming"). Rendered inline so it inherits text colour via
 * `currentColor` and works unchanged in light + dark mode.
 *
 * Decorative only: `aria-hidden` + `focusable="false"` keep it out of the
 * accessibility tree. The accessible name ("Escuchar en Apple Music") lives on
 * the parent `<a>`, and the platform is also conveyed by its visible text label
 * — never by icon shape or colour alone (Constitution X).
 */
export function AppleMusicIcon({ className = 'h-4 w-4' }: AppleMusicIconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <path d="M20 4c0-.62-.55-1.08-1.24-.96L9.83 4.9C9.34 4.99 9 5.42 9 5.92V15a3.5 3.5 0 1 0 2 3.16V9.7l7-1.28V13a3.5 3.5 0 1 0 2 3.16V4Z" />
    </svg>
  );
}
