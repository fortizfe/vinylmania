import { useEffect, useState } from 'react';
import clsx from 'clsx';

import { FiltersControl } from './FiltersControl';
import {
  LIBRARY_SORT_OPTIONS,
  type LibrarySortValue,
} from '../constants/librarySortOptions';
import type { ViewMode } from '../hooks/useViewModePreference';
import { Button } from './ui/Button';
import { Modal } from './ui/Modal';
import { focusRing } from './ui/focusRing';
import { pressableRow } from './ui/press';
import { ViewModeToggle } from './ui/ViewModeToggle';

/**
 * The facet shape both screens share. Declared structurally so the toolbar
 * depends on the props abstraction rather than on `LibraryFilters` and the
 * query-param layer behind it (Constitution IV).
 */
interface ToolbarFilters {
  genre?: string[];
  style?: string[];
  format?: string[];
}

interface LibraryToolbarProps {
  mode: ViewMode;
  onModeChange: (mode: ViewMode) => void;
  sort: LibrarySortValue;
  onSortChange: (sort: LibrarySortValue) => void;
  filters: ToolbarFilters;
  /** Called with the full next selection as soon as a facet is ticked. */
  onFiltersChange: (filters: ToolbarFilters) => void;
  onClear: () => void;
}

const GROUPS = [...new Set(LIBRARY_SORT_OPTIONS.map((o) => o.group))];
const toValue = ({ sort, dir }: LibrarySortValue) => `${sort}:${dir}`;

function activeCount(filters: ToolbarFilters): number {
  return (
    (filters.genre?.length ?? 0) +
    (filters.style?.length ?? 0) +
    (filters.format?.length ?? 0)
  );
}

/**
 * The active-filter count, as a number *and* as words (FR-024, contracts §4):
 * state is never carried by the amber alone. The digit is `aria-hidden` so
 * the name reads "Filters, 2 active filters" rather than "Filters 2 2 active
 * filters". Amber `accent` is opaque, so `stone-900` on it holds 8.14:1 even
 * over the translucent bar (research D17).
 */
function FilterCount({ count }: { count: number }) {
  if (count === 0) return null;
  return (
    <>
      <span
        aria-hidden="true"
        className="ml-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-accent px-1.5 text-xs font-semibold text-stone-900"
      >
        {count}
      </span>
      <span className="sr-only">
        , {count} active {count === 1 ? 'filter' : 'filters'}
      </span>
    </>
  );
}

/**
 * The library's one controls bar (feature 068, research D15/D18): a single
 * element restyled by breakpoint — a floating capsule below 640 px, a sticky
 * toolbar spanning the content width from 640 px up — so `ViewModeToggle` is
 * mounted exactly once and no layout is device-detected.
 *
 * It owns one `Modal`: the "Sort & Filter" bottom sheet (sort radios + live
 * filters) below 640 px, the "Filters" end drawer (live filters) above. Both
 * reuse the existing overlay stack, so focus trap, focus restore, scroll
 * lock, Escape/scrim/drag dismissal and the reduced-motion path come for
 * free (D16). Crossing the breakpoint closes an open panel, because the
 * trigger it belongs to is about to disappear.
 *
 * The panel renders as a sibling of the bar, not inside it: the bar's `z-30`
 * opens a stacking context that would trap the overlay's `z-50` underneath
 * the app header.
 */
export function LibraryToolbar({
  mode,
  onModeChange,
  sort,
  onSortChange,
  filters,
  onFiltersChange,
  onClear,
}: LibraryToolbarProps) {
  const [open, setOpen] = useState(false);
  // Which panel was opened last. Kept separate from `open` so the title and
  // anchor edge stay put while the exit animation plays.
  const [panel, setPanel] = useState<'sheet' | 'drawer'>('sheet');
  const count = activeCount(filters);

  useEffect(() => {
    const query = window.matchMedia('(min-width: 640px)');
    const close = () => setOpen(false);
    query.addEventListener('change', close);
    return () => query.removeEventListener('change', close);
  }, []);

  function openPanel(next: 'sheet' | 'drawer') {
    setPanel(next);
    setOpen(true);
  }

  const liveFilters = (
    <FiltersControl live filters={filters} onApply={onFiltersChange} onClear={onClear} />
  );

  return (
    <>
      <div
        className={clsx(
          // Capsule (< 640 px): floating above the content, clear of the home
          // indicator; `--capsule-clearance` keeps the list out from under it.
          'chrome-material fixed inset-x-0 bottom-[calc(1rem+env(safe-area-inset-bottom))] z-30 mx-auto flex w-fit items-center gap-2 rounded-full bg-white/90 p-2 shadow-lg ring-1 ring-stone-950/5 backdrop-blur-xl backdrop-saturate-150 dark:bg-surface/90 dark:ring-white/10',
          // Toolbar (≥ 640 px): the same element, sticking under the app
          // header and spanning `<main>`'s content width (FR-018).
          'sm:sticky sm:inset-x-auto sm:bottom-auto sm:top-(--header-h) sm:mx-0 sm:h-15 sm:w-full sm:gap-3 sm:rounded-2xl sm:px-3 sm:shadow-none',
        )}
      >
        <ViewModeToggle mode={mode} onChange={onModeChange} screen="library" />

        <Button
          variant="secondary"
          className="inline-flex items-center gap-1 sm:hidden"
          aria-haspopup="dialog"
          aria-expanded={open && panel === 'sheet'}
          onClick={() => openPanel('sheet')}
        >
          Sort &amp; Filter
          <FilterCount count={count} />
        </Button>

        <div className="hidden items-center gap-2 sm:flex">
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

        <Button
          variant="secondary"
          className="hidden items-center gap-1 sm:ml-auto sm:inline-flex"
          aria-haspopup="dialog"
          aria-expanded={open && panel === 'drawer'}
          onClick={() => openPanel('drawer')}
        >
          Filters
          <FilterCount count={count} />
        </Button>
      </div>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        position={panel === 'sheet' ? 'bottom' : 'end'}
        title={panel === 'sheet' ? 'Sort & Filter' : 'Filters'}
      >
        <div className="flex flex-col gap-4">
          {panel === 'sheet' && (
            <fieldset>
              <legend className="mb-1 text-sm font-semibold text-stone-900 dark:text-stone-100">
                Sort by
              </legend>
              {/* One `name` across the three criterion fieldsets, so the
                  arrow keys rove the whole set natively (contracts §4). */}
              <div className="flex flex-col gap-2">
                {GROUPS.map((group) => (
                  <fieldset key={group}>
                    <legend className="text-xs font-medium tracking-wide text-stone-500 uppercase dark:text-stone-400">
                      {group}
                    </legend>
                    {LIBRARY_SORT_OPTIONS.filter((o) => o.group === group).map(
                      (option) => (
                        <label
                          key={toValue(option)}
                          className={clsx(
                            'flex min-h-11 items-center gap-3 rounded-lg px-1 text-sm text-stone-900 dark:text-stone-100',
                            pressableRow,
                          )}
                        >
                          <input
                            type="radio"
                            name="library-sort"
                            value={toValue(option)}
                            checked={toValue(option) === toValue(sort)}
                            onChange={() =>
                              onSortChange({ sort: option.sort, dir: option.dir })
                            }
                            className={clsx('h-5 w-5 accent-primary', focusRing)}
                          />
                          {option.label}
                        </label>
                      ),
                    )}
                  </fieldset>
                ))}
              </div>
            </fieldset>
          )}
          {liveFilters}
        </div>
      </Modal>
    </>
  );
}
