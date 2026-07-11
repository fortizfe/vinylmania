// Shared, visually-hidden SVG filter def (feature 034, research.md §3),
// matching the design brief's `#grungeF`. Mounted once at the app root;
// any VinylmaniaWordmark with `grunge` references it via `filter: url(#vm-wordmark-grunge)`.
export function VinylmaniaGrungeFilter() {
  return (
    <svg aria-hidden="true" className="absolute h-0 w-0">
      <filter id="vm-wordmark-grunge" x="-20%" y="-20%" width="140%" height="140%">
        <feTurbulence type="fractalNoise" baseFrequency={0.9} numOctaves={2} seed={3} result="noise" />
        <feDisplacementMap in="SourceGraphic" in2="noise" scale={0.6} />
      </filter>
    </svg>
  );
}
