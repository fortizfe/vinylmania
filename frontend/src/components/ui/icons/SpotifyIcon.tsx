interface SpotifyIconProps {
  /** Tailwind sizing/spacing classes. Defaults to the shared icon size. */
  className?: string;
}

/**
 * Spotify mark — three stacked sound waves inside a circle (feature 062,
 * "Escúchalo en Streaming"). Rendered inline so it inherits text colour via
 * `currentColor` and works unchanged in light + dark mode.
 *
 * Decorative only: `aria-hidden` + `focusable="false"` keep it out of the
 * accessibility tree. The accessible name ("Escuchar en Spotify") lives on the
 * parent `<a>`, and the platform is also conveyed by its visible text label —
 * never by icon shape or colour alone (Constitution X).
 */
export function SpotifyIcon({ className = 'h-4 w-4' }: SpotifyIconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm4.586 14.424a.623.623 0 0 1-.857.207c-2.348-1.435-5.304-1.76-8.785-.964a.623.623 0 1 1-.278-1.215c3.81-.872 7.077-.496 9.713 1.115a.623.623 0 0 1 .207.857Zm1.224-2.723a.78.78 0 0 1-1.072.257c-2.687-1.652-6.785-2.13-9.965-1.166a.78.78 0 1 1-.452-1.493c3.63-1.1 8.146-.567 11.232 1.33a.78.78 0 0 1 .257 1.072Zm.105-2.835c-3.223-1.914-8.54-2.09-11.618-1.156a.935.935 0 1 1-.542-1.79c3.532-1.072 9.404-.865 13.115 1.338a.935.935 0 1 1-.955 1.608Z" />
    </svg>
  );
}
