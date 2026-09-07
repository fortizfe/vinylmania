import type { ReleaseIdentifier } from '../services/libraryApi';

interface ReleaseAdditionalInfoSectionProps {
  notes?: string;
  identifiers: ReleaseIdentifier[];
}

/**
 * "Rest of catalog information" — catalog notes + pressing identifiers only.
 *
 * Feature 063 (contracts/ui-contracts.md §C6) removed the `community` prop and
 * its "{have} have / {want} want · rating …" line; the Discogs community
 * rating and the have/want counts now live in `RatingCard`. This section
 * renders `null` when there is nothing left to show.
 */
export function ReleaseAdditionalInfoSection({
  notes,
  identifiers,
}: ReleaseAdditionalInfoSectionProps) {
  // `identifiers` is typed as required, but an incomplete API response (or
  // a stale test fixture) can still deliver `undefined` at runtime — guard
  // defensively rather than crashing the whole page render (spec 036).
  const safeIdentifiers = identifiers ?? [];
  const hasContent = Boolean(notes) || safeIdentifiers.length > 0;

  if (!hasContent) return null;

  return (
    <div className="flex flex-col gap-3 border-t border-stone-200 pt-4 dark:border-stone-900">
      {notes && <p className="text-sm text-stone-700 dark:text-stone-300">{notes}</p>}

      {safeIdentifiers.length > 0 && (
        <ul className="flex flex-col gap-1 text-sm text-stone-500 dark:text-stone-400">
          {safeIdentifiers.map((identifier) => (
            <li key={`${identifier.type}-${identifier.value}`}>
              {identifier.type}: {identifier.value}
              {identifier.description && ` (${identifier.description})`}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
