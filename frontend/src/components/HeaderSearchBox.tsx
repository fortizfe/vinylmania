import {
  type FocusEvent,
  type FormEvent,
  type KeyboardEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';
import { useLocation, useNavigate } from 'react-router-dom';
import clsx from 'clsx';

import { useEscapeKey } from '../hooks/useEscapeKey';
import { buildSearchPath, useSearchQueryParams } from '../hooks/useSearchQueryParams';
import {
  m,
  motionDuration,
  spring,
  usePrefersReducedMotion,
  useRestoreFocus,
  useScrollLock,
} from '../motion';
import { useCatalogSuggestions } from '../queries/discogsQueries';
import type { CatalogSuggestion } from '../services/discogsApi';
import { ApiError } from '../services/apiClient';
import {
  HeaderSuggestionPanel,
  type SuggestionPanelState,
} from './HeaderSuggestionPanel';
import { Button } from './ui/Button';
import { Input } from './ui/Input';

const SEARCH_RESULTS_PATH = '/app/search';
/** research D9 — long enough to survive a normal typing rhythm, short enough to feel instant. */
const DEBOUNCE_MS = 300;

/**
 * Tailwind's `sm:` / `md:` thresholds, read from JS. Two consumers only: the
 * scroll lock (FR-005 suspends the page behind the phone overlay, which no
 * utility class can express) and the animated width (`motion` needs a value,
 * not a breakpoint utility). Everything else stays in the class list.
 */
function useMinWidth(px: number): boolean {
  const [matches, setMatches] = useState(
    () => window.matchMedia(`(min-width: ${px}px)`).matches,
  );

  useEffect(() => {
    const mql = window.matchMedia(`(min-width: ${px}px)`);
    const onChange = () => setMatches(mql.matches);
    onChange();
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, [px]);

  return matches;
}

function SearchIcon() {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      className="h-4 w-4"
    >
      <circle cx="9" cy="9" r="6" strokeLinecap="round" strokeLinejoin="round" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M17 17l-4-4" />
    </svg>
  );
}

/**
 * The header search (spec 069 US1). Two purpose-built layouts split at 640 px
 * (research D14): below it a 44×44 icon control whose activation mounts a
 * full-width overlay pinned under the header; from 640 px up the field is
 * visible and the form widens in place. Non-modal at every width
 * (clarification 3) — no dialog role, no modal attribute, no focus trap, so
 * the page behind stays in the accessibility tree and Tab can leave (which
 * collapses the search, FR-007).
 */
export function HeaderSearchBox() {
  const location = useLocation();
  const navigate = useNavigate();
  const onResultsPage = location.pathname === SEARCH_RESULTS_PATH;
  const { query: urlQuery, ...activeFilters } = useSearchQueryParams();

  const [value, setValue] = useState(() => (onResultsPage ? urlQuery : ''));
  const [expanded, setExpanded] = useState(false);
  // Empty until the collector has actually typed: a pre-filled field must
  // never leave a settled value behind that the first keystroke could spend
  // a lookup on (FR-004, clarification 4).
  const [debounced, setDebounced] = useState('');
  // Activation alone never costs a lookup, however long the query already in
  // the field (FR-004, clarification 4).
  const [hasEdited, setHasEdited] = useState(false);
  // The option `aria-activedescendant` points at; arrows never move DOM focus
  // (research D11, contracts §4).
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  const formRef = useRef<HTMLFormElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);

  const isWide = useMinWidth(640);
  const isMd = useMinWidth(768);
  const reduceMotion = usePrefersReducedMotion();

  // Order matters (the same ordering `motion/Overlay` relies on): capture the
  // control that opened the search BEFORE the activation effect below moves
  // focus into the field.
  useRestoreFocus(expanded, restoreFocusRef);
  useScrollLock(expanded && !isWide);

  // Closing the panel is re-gating it: the next edit opens it again.
  const closePanel = useCallback(() => {
    setHasEdited(false);
    setDebounced('');
    setActiveIndex(null);
  }, []);

  const collapse = useCallback(() => {
    setExpanded(false);
    closePanel();
  }, [closePanel]);

  useEffect(() => {
    if (!hasEdited) return;
    const timer = setTimeout(() => setDebounced(value), DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [value, hasEdited]);

  // Gated on what is in the field *now*, not on the debounced copy, so
  // emptying it closes the panel at once instead of 300 ms later (FR-015).
  const lookupQuery = debounced.trim();
  const showPanel = hasEdited && value.trim().length >= 2 && lookupQuery.length >= 2;
  const {
    data: suggestions,
    error,
    isFetching,
    refetch,
  } = useCatalogSuggestions(lookupQuery, showPanel);
  // data-model §5. A 401 belongs to the existing sign-in path (apiClient's
  // unauthorized handler), never to the panel's error state — except a
  // revoked Discogs link, which apiClient keeps out of that path too.
  const sessionExpired =
    error instanceof ApiError &&
    error.status === 401 &&
    error.code !== 'discogs_link_invalid';
  let panelState: SuggestionPanelState = 'idle';
  if (showPanel && !sessionExpired) {
    if (error && !isFetching) panelState = 'error';
    else if (!suggestions) panelState = 'loading';
    else panelState = suggestions.length === 0 ? 'empty' : 'suggestions';
  }
  const options = panelState === 'suggestions' ? (suggestions ?? []) : [];
  const active =
    activeIndex !== null && activeIndex < options.length ? activeIndex : null;

  // contracts §4: the first Escape closes the panel (text and focus kept), the
  // next collapses the search.
  useEscapeKey(showPanel ? closePanel : collapse, expanded);

  // contracts §5 — one polite string per state; empty while nothing is looked
  // up, which covers collapse, an emptied field and a pre-filled activation.
  const announcement = {
    idle: '',
    loading: 'Searching…',
    empty: `No suggestions for “${lookupQuery}”.`,
    error: 'Suggestions are unavailable. Retry is available.',
    suggestions: `${options.length} ${options.length === 1 ? 'suggestion' : 'suggestions'} available.`,
  }[panelState];

  useEffect(() => {
    setValue(onResultsPage ? urlQuery : '');
  }, [onResultsPage, urlQuery]);

  // FR-003 + FR-004: one interaction lands DOM focus in the field, and the
  // query in effect arrives selected so a single keystroke replaces it.
  useEffect(() => {
    if (!expanded) return;
    inputRef.current?.focus();
    // Opened by an edit (below): selecting would let the next keystroke
    // replace what was just typed.
    if (!hasEdited) inputRef.current?.select();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only the rising edge of `expanded`
  }, [expanded]);

  /**
   * Activation is an *interaction*, never the field merely holding focus:
   * from 640 px up the field is its own opener, so collapsing hands focus
   * straight back to it (FR-007) — expanding on `focus` would re-open the
   * search the instant it closed.
   */
  function open() {
    // Escape and the backdrop restore focus to whatever `useRestoreFocus`
    // captures on this rising edge — the icon control below 640 px, the field
    // itself above it.
    restoreFocusRef.current = null;
    setExpanded(true);
  }

  function handleActivate(event: FormEvent) {
    // From 640 px up the field is always visible, so this is only ever the
    // submit button (contracts §1).
    if (expanded || isWide) return;
    // Collapsed, this control opens the search instead of submitting it.
    event.preventDefault();
    open();
  }

  function handleBlur(event: FocusEvent<HTMLFormElement>) {
    if (!expanded) return;
    const next = event.relatedTarget;
    if (next instanceof HTMLElement && formRef.current?.contains(next)) return;
    // FR-007 at every width. The collector moved focus somewhere on purpose,
    // so aim `useRestoreFocus` at that target — refocusing it is a no-op —
    // rather than dragging focus back to the opener.
    restoreFocusRef.current = next instanceof HTMLElement ? next : null;
    collapse();
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const trimmed = value.trim();
    if (trimmed.length === 0) {
      return;
    }
    // Submitting a new query while already on the results screen preserves
    // any active filters, re-applying them against the new query (edge
    // case, spec 021-search-result-filters).
    navigate(buildSearchPath(trimmed, 1, onResultsPage ? activeFilters : undefined), {
      replace: onResultsPage,
    });
    collapse();
  }

  /** contracts §4. Enter with no active option falls through to the form submit. */
  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    const last = options.length - 1;
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      if (last < 0) return;
      // Keeps the caret put; DOM focus never leaves the field.
      event.preventDefault();
      // No wrap: past either end is "no active option", so Enter can submit.
      if (event.key === 'ArrowDown') {
        setActiveIndex(active === null ? 0 : active === last ? null : active + 1);
      } else {
        setActiveIndex(active === null ? last : active === 0 ? null : active - 1);
      }
    } else if (event.key === 'Enter' && active !== null) {
      event.preventDefault();
      handleSelect(options[active]);
    } else if (event.key === 'Escape') {
      // A native search field clears itself on Escape; `useEscapeKey` decides
      // what Escape does here, and it never discards the text.
      event.preventDefault();
    }
  }

  /** FR-012 / contracts §6 — the destination is the row's `resultType`, nothing else. */
  function handleSelect(suggestion: CatalogSuggestion) {
    collapse();
    if (suggestion.resultType === 'artist') {
      // No artist screen in the app: open the full results for that name.
      navigate(buildSearchPath(suggestion.title));
      return;
    }
    const segment = suggestion.resultType === 'master' ? 'masters' : 'releases';
    navigate(`/app/${segment}/${suggestion.discogsId}`);
  }

  return (
    <>
      {expanded &&
        createPortal(
          // Decorative (contracts §3). `.overlay-scrim` already carries the
          // `@supports not (backdrop-filter)`, `prefers-reduced-transparency`
          // and `prefers-contrast: more` fallbacks, so no new CSS is written
          // (research D12). Portalled to `<body>`: inside the header's `z-40`
          // stacking context it would paint over the brand and the nav.
          <m.div
            aria-hidden="true"
            onClick={collapse}
            className="overlay-scrim fixed inset-0 z-30 bg-stone-950/60 backdrop-blur-xl"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: reduceMotion ? 0 : motionDuration.fade / 1000 }}
          />,
          document.body,
        )}
      <m.form
        ref={formRef}
        onSubmit={handleSubmit}
        onBlur={handleBlur}
        role="search"
        initial={false}
        // ponytail: animating width runs layout on the header row each frame;
        // ceiling is a measurable header frame drop; upgrade path is
        // ViewModeToggle's measured-transform approach
        animate={{
          width: isWide ? (expanded ? '24rem' : isMd ? '20rem' : '16rem') : 'auto',
        }}
        transition={reduceMotion ? { duration: 0 } : spring.sheet}
        className={clsx(
          // `relative`: the panel is positioned against the form and lives
          // inside it, so focus moving into it is focus staying in the search
          // (contracts §1).
          'relative flex items-center gap-2',
          // Below 640 px the expanded search is a full-width bar pinned under
          // the header (FR-005). It carries the header's own opaque surface,
          // so every pairing inside it — field, icon control — stays the
          // pairing the app already proved, instead of sitting on the scrim
          // (contracts §8).
          expanded &&
            'max-sm:fixed max-sm:inset-x-0 max-sm:top-(--header-h) max-sm:z-40 max-sm:bg-white max-sm:px-4 max-sm:pt-2 max-sm:pb-3 max-sm:dark:bg-surface-raised',
        )}
      >
        <div className={clsx('min-w-0 flex-1', !expanded && 'hidden sm:block')}>
          <Input
            ref={inputRef}
            id="header-search"
            label="Search Discogs"
            hideLabel
            type="search"
            role="combobox"
            aria-expanded={panelState !== 'idle'}
            aria-controls="header-search-listbox"
            aria-autocomplete="list"
            aria-activedescendant={
              active === null ? undefined : `header-search-option-${active}`
            }
            placeholder="Search Discogs…"
            value={value}
            onChange={(event) => {
              setValue(event.target.value);
              setHasEdited(true);
              setActiveIndex(null);
              // From 640 px up the field can take focus by Tab, never passing
              // through `open()`; typing into it is the activation
              // (contracts §1), so Enter and the Search button submit.
              if (!expanded) open();
            }}
            onKeyDown={handleKeyDown}
            onClick={open}
          />
        </div>
        <Button
          type="submit"
          size="icon"
          variant="secondary"
          aria-label="Search"
          aria-expanded={expanded}
          onClick={handleActivate}
          // Safari never focuses a clicked button: without this the field's
          // `focusout` has no `relatedTarget`, collapses the search, and the
          // click re-opens it instead of submitting.
          onMouseDown={expanded ? (event) => event.preventDefault() : undefined}
        >
          <SearchIcon />
        </Button>
        <HeaderSuggestionPanel
          state={panelState}
          suggestions={options}
          activeIndex={active}
          query={lookupQuery}
          onSelect={handleSelect}
          onRetry={() => {
            // The Retry button unmounts on the way back to `loading`; hand
            // focus to the field first so it isn't dropped (and the search
            // doesn't collapse on the resulting focusout).
            inputRef.current?.focus();
            void refetch();
          }}
        />
        {/* Polite announcements (contracts §5). */}
        <p role="status" className="sr-only">
          {announcement}
        </p>
      </m.form>
    </>
  );
}
