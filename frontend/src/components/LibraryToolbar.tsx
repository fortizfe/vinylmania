import clsx from 'clsx';

import {
  LIBRARY_SORT_OPTIONS,
  type LibrarySortValue,
} from '../constants/librarySortOptions';
import type { ViewMode } from '../hooks/useViewModePreference';
import { focusRing } from './ui/focusRing';
import { ViewModeToggle } from './ui/ViewModeToggle';

interface LibraryToolbarProps {
  mode: ViewMode;
  onModeChange: (mode: ViewMode) => void;
  sort: LibrarySortValue;
  onSortChange: (sort: LibrarySortValue) => void;
}

const GROUPS = [...new Set(LIBRARY_SORT_OPTIONS.map((o) => o.group))];
const toValue = ({ sort, dir }: LibrarySortValue) => `${sort}:${dir}`;

/**
 * The library's one controls bar (feature 068, research D15). In US1 it is a
 * plain in-flow row; US3 turns it into the capsule / sticky toolbar.
 * `ViewModeToggle` is mounted exactly once.
 */
export function LibraryToolbar({
  mode,
  onModeChange,
  sort,
  onSortChange,
}: LibraryToolbarProps) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <ViewModeToggle mode={mode} onChange={onModeChange} screen="library" />
      <div className="flex items-center gap-2">
        <label
          htmlFor="library-sort"
          className="text-sm font-medium text-stone-700 dark:text-stone-300"
        >
          Sort
        </label>
        <select
          id="library-sort"
          value={toValue(sort)}
          onChange={(event) => {
            const option = LIBRARY_SORT_OPTIONS.find(
              (o) => toValue(o) === event.target.value,
            );
            if (option) {
              onSortChange({ sort: option.sort, dir: option.dir });
            }
          }}
          className={clsx(
            'min-h-11 rounded-lg border border-stone-500 bg-white px-3 text-sm text-stone-900 dark:border-border-dark dark:bg-surface-raised dark:text-stone-100 dark:[color-scheme:dark]',
            focusRing,
          )}
        >
          {GROUPS.map((group) => (
            <optgroup key={group} label={group}>
              {LIBRARY_SORT_OPTIONS.filter((o) => o.group === group).map((o) => (
                <option key={toValue(o)} value={toValue(o)}>
                  {o.label}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </div>
    </div>
  );
}
