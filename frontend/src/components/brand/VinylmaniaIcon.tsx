import clsx from 'clsx';

interface VinylmaniaIconProps {
  size: number;
  className?: string;
}

// Circular "VM" brand icon (feature 034, research.md §1-2, §4). One markup,
// light/dark driven entirely by dark: fill classes on existing @theme
// color tokens — no duplicated light/dark SVGs. Purely decorative: always
// aria-hidden, with the accessible name carried by the wrapping link/wordmark.
export function VinylmaniaIcon({ size, className }: VinylmaniaIconProps) {
  return (
    <svg
      viewBox="0 0 200 200"
      width={size}
      height={size}
      aria-hidden="true"
      focusable="false"
      className={clsx('shrink-0', className)}
    >
      <circle cx="100" cy="100" r="85" className="fill-landing-surface dark:fill-brand-icon-dark-bg" />
      <circle
        cx="100"
        cy="100"
        r="72"
        fill="none"
        className="stroke-white/12 dark:stroke-white/14"
        strokeWidth="1.5"
      />
      <circle
        cx="100"
        cy="100"
        r="60"
        fill="none"
        className="stroke-white/12 dark:stroke-white/14"
        strokeWidth="1.5"
      />
      <circle
        cx="100"
        cy="100"
        r="48"
        fill="none"
        className="stroke-white/12 dark:stroke-white/14"
        strokeWidth="1.5"
      />
      <circle cx="100" cy="100" r="34" className="fill-landing-accent dark:fill-primary" />
      <text
        x="100"
        y="112"
        textAnchor="middle"
        fontFamily="Anton"
        fontSize="30"
        className="fill-landing-surface dark:fill-white"
      >
        VM
      </text>
    </svg>
  );
}
