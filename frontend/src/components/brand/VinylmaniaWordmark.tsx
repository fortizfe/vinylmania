import clsx from 'clsx';

interface VinylmaniaWordmarkProps {
  grunge?: boolean;
  className?: string;
}

// "VINYLMANIA" wordmark in the Anton display font (feature 034, research.md §3).
// `grunge` applies the shared VinylmaniaGrungeFilter's distressed effect —
// large-format placements only (landing hero, general logo), per the
// Clarifications session; header/landing-header lockups always pass false.
export function VinylmaniaWordmark({ grunge = false, className }: VinylmaniaWordmarkProps) {
  return (
    <span
      className={clsx('font-display', className)}
      style={grunge ? { filter: 'url(#vm-wordmark-grunge)' } : undefined}
    >
      VINYLMANIA
    </span>
  );
}
