import clsx from 'clsx';

import type { CatalogSuggestion } from '../services/discogsApi';
import { Button } from './ui/Button';
import { Card } from './ui/Card';

/** The displayable panel states of data-model.md §5; `idle` renders nothing at all. */
export type SuggestionPanelState = 'idle' | 'loading' | 'suggestions' | 'empty' | 'error';

interface HeaderSuggestionPanelProps {
  state: SuggestionPanelState;
  suggestions?: CatalogSuggestion[];
  /** The option the field's `aria-activedescendant` points at, or none (contracts §4). */
  activeIndex?: number | null;
  /** The text that was looked up, named back in the `empty` state (FR-018). */
  query?: string;
  onSelect: (suggestion: CatalogSuggestion) => void;
  onRetry: () => void;
}

/**
 * Every row — skeleton or real — is exactly this tall, which is what keeps the
 * panel from resizing between `loading` and `suggestions` (FR-014, SC-008).
 */
const ROW = 'h-14 rounded-md';

const SKELETON_ROWS = 5;

/**
 * Five `h-14` rows plus the listbox's four `gap-1` gaps = 18.5rem: the
 * `empty` / `error` body is exactly as tall as `loading` (SC-008).
 */
const MESSAGE_BLOCK =
  'flex h-74 flex-col items-center justify-center gap-3 px-4 text-center';

/** "album" is the collector-facing word for either kind of record (data-model §1). */
function kindLabel(resultType: CatalogSuggestion['resultType']): string {
  return resultType === 'artist' ? 'Artist' : 'Album';
}

/** Artist rows carry no secondary detail; album rows carry whatever Discogs gave. */
function secondaryDetail(suggestion: CatalogSuggestion): string {
  return [suggestion.artist, suggestion.year, suggestion.format]
    .filter((part) => part !== undefined)
    .join(' · ');
}

/**
 * The floating suggestion surface under the header field (069 US2). It is the
 * app's existing `Card`, never a `SearchResultCard` — a listbox row is not a
 * link and choosing one is the owner's decision, not a navigation the panel
 * performs (research D16).
 *
 * The listbox is rendered in every displayed state so `aria-controls` on the
 * field can never dangle (contracts §3). DOM focus never enters it: the field
 * owns `aria-activedescendant`, this panel owns the ids it points at (US3).
 */
export function HeaderSuggestionPanel({
  state,
  suggestions = [],
  activeIndex = null,
  query = '',
  onSelect,
  onRetry,
}: HeaderSuggestionPanelProps) {
  if (state === 'idle') return null;

  return (
    <Card
      data-testid="header-search-panel"
      padding="sm"
      className="absolute inset-x-0 top-full z-10 mt-2 shadow-lg max-sm:mx-4"
      // Keeps DOM focus in the field while anything in the panel is pressed —
      // a row, the padding, a message, Retry (Safari never focuses a clicked
      // button): without it the pointer-down blurs the input, the search
      // collapses on `focusout` (contracts §1) and the click never lands.
      onMouseDown={(event) => event.preventDefault()}
    >
      <ul
        role="listbox"
        id="header-search-listbox"
        aria-label="Search suggestions"
        className="flex flex-col gap-1"
      >
        {state === 'loading' &&
          Array.from({ length: SKELETON_ROWS }, (_unused, index) => (
            <li
              // Decorative placeholders, not results: the listbox exposes
              // zero options and the count lives in the status region.
              key={index}
              role="presentation"
              aria-hidden="true"
              // `animate-pulse` is safe unstyled here: global.css neutralizes
              // every animation under `prefers-reduced-motion: reduce`.
              // `dark:bg-border-dark`, not the Card's own `surface-raised`
              // (1.00:1, invisible): ~3.75:1 against the panel (FR-025).
              className={clsx(ROW, 'animate-pulse bg-stone-200 dark:bg-border-dark')}
            />
          ))}
        {state === 'suggestions' &&
          suggestions.map((suggestion, index) => {
            const detail = secondaryDetail(suggestion);
            const active = index === activeIndex;
            return (
              <li
                key={`${suggestion.resultType}-${suggestion.discogsId}`}
                role="option"
                id={`header-search-option-${index}`}
                aria-selected={active}
                // Stated, not computed from content: the title and detail
                // are block boxes, and name-from-content pads every block
                // with spaces ("Kind Of Blue , Miles Davis …").
                aria-label={[suggestion.title, detail, kindLabel(suggestion.resultType)]
                  .filter(Boolean)
                  .join(', ')}
                onClick={() => onSelect(suggestion)}
                className={clsx(
                  ROW,
                  'flex cursor-pointer items-center gap-3 px-2 hover:bg-stone-100 dark:hover:bg-stone-800',
                  // DOM focus stays in the field, so the active row draws the
                  // app's focus ring itself (WCAG 2.4.7) — not a tint alone.
                  active &&
                    'bg-stone-100 ring-2 ring-primary ring-inset dark:bg-stone-800',
                )}
              >
                {suggestion.thumbnailUrl ? (
                  <img
                    // Decorative: the row's name is its text (contracts §3).
                    alt=""
                    src={suggestion.thumbnailUrl}
                    className="h-10 w-10 shrink-0 rounded object-cover"
                  />
                ) : (
                  <span className="h-10 w-10 shrink-0 rounded bg-stone-200 dark:bg-stone-800" />
                )}
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-stone-900 dark:text-stone-100">
                    {suggestion.title}
                  </span>
                  {/* Word boundaries for the row's text, which the
                        accessible name above doesn't depend on. */}{' '}
                  {detail && (
                    <span className="block truncate text-sm text-stone-600 dark:text-stone-400">
                      {detail}
                    </span>
                  )}
                </span>{' '}
                {/* Text, never colour alone (FR-025). */}
                <span className="shrink-0 rounded-full bg-stone-200 px-2 py-0.5 text-xs font-medium text-stone-600 dark:bg-stone-800 dark:text-stone-400">
                  {kindLabel(suggestion.resultType)}
                </span>
              </li>
            );
          })}
      </ul>
      {/* Outside the listbox: messages, not options (contracts §3). Polite
          announcement lives in the field's status region — no role="alert"
          (FR-023). */}
      {state === 'empty' && (
        <div className={MESSAGE_BLOCK}>
          <p className="text-stone-600 dark:text-stone-400">
            No suggestions for “{query}”. Try fewer or different words.
          </p>
        </div>
      )}
      {state === 'error' && (
        <div className={MESSAGE_BLOCK}>
          <p className="text-stone-600 dark:text-stone-400">
            Suggestions are unavailable right now.
          </p>
          <Button
            type="button"
            variant="secondary"
            onClick={onRetry}
            className="min-w-11"
          >
            Retry
          </Button>
        </div>
      )}
    </Card>
  );
}
