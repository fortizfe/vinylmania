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
  const hasContent = Boolean(notes) || identifiers.length > 0 || Boolean(community);

  if (!hasContent) return null;

  return (
    <div className="flex flex-col gap-3 border-t border-gray-200 pt-4 dark:border-gray-800">
      {notes && <p className="text-sm text-gray-700 dark:text-gray-300">{notes}</p>}

      {identifiers.length > 0 && (
        <ul className="flex flex-col gap-1 text-sm text-gray-500 dark:text-gray-400">
          {identifiers.map((identifier) => (
            <li key={`${identifier.type}-${identifier.value}`}>
              {identifier.type}: {identifier.value}
              {identifier.description && ` (${identifier.description})`}
            </li>
          ))}
        </ul>
      )}

      {community && (
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {community.have} have / {community.want} want · rating {community.rating.average} (
          {community.rating.count})
        </p>
      )}
    </div>
  );
}
