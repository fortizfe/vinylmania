/**
 * Outline trash can — the "remove" action icon. A shape the trash-can
 * metaphor makes unambiguous; the interactive control still carries a real
 * accessible name (`aria-label`), so the icon is decorative only
 * (Constitution X — never icon-only-ambiguous, never colour-only).
 */
export function TrashIcon() {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      className="h-4 w-4"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M4 6h12M8 6V4.5A1.5 1.5 0 0 1 9.5 3h1A1.5 1.5 0 0 1 12 4.5V6m2 0v9a1.5 1.5 0 0 1-1.5 1.5h-5A1.5 1.5 0 0 1 6 15V6m2.5 3v5m3-5v5"
      />
    </svg>
  );
}
