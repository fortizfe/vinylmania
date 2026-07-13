import type { CommunityStats, ReleaseIdentifier } from '../services/libraryApi';

interface ReleaseAdditionalInfoSectionProps {
  notes?: string;
  identifiers: ReleaseIdentifier[];
  community?: CommunityStats;
}

export function ReleaseAdditionalInfoSection({
  notes,
  identifiers,
  community,
}: ReleaseAdditionalInfoSectionProps) {
  // `identifiers` is typed as required, but an incomplete API response (or
  // a stale test fixture) can still deliver `undefined` at runtime — guard
  // defensively rather than crashing the whole page render (spec 036).
  const safeIdentifiers = identifiers ?? [];
  const hasContent = Boolean(notes) || safeIdentifiers.length > 0 || Boolean(community);

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

      {community && (
        <p className="text-sm text-stone-500 dark:text-stone-400">
          {community.have} have / {community.want} want · rating{' '}
          {community.rating.average} ({community.rating.count})
        </p>
      )}
    </div>
  );
}
