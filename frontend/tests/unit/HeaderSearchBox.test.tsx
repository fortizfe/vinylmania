import { QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation, useNavigate } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { HeaderSearchBox } from '../../src/components/HeaderSearchBox';
import { ApiError } from '../../src/services/apiClient';
import type { CatalogSuggestion } from '../../src/services/discogsApi';
import { createTestQueryClient } from '../testUtils';

// The suggestion lookup is counted at the service boundary: whatever the
// debounce and the query cache do between them, this is the number of
// requests the collector's typing costs (FR-010, SC-004).
const { mockSuggest } = vi.hoisted(() => ({ mockSuggest: vi.fn() }));

vi.mock('../../src/services/discogsApi', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../src/services/discogsApi')>()),
  suggest: mockSuggest,
}));

function LocationDisplay() {
  const location = useLocation();
  return <div data-testid="location">{`${location.pathname}${location.search}`}</div>;
}

function GoToWishlistButton() {
  const navigate = useNavigate();
  return (
    <button type="button" onClick={() => navigate('/app/wishlist')}>
      Go to wishlist
    </button>
  );
}

function GoBackButton() {
  const navigate = useNavigate();
  return (
    <button type="button" onClick={() => navigate(-1)}>
      Go back
    </button>
  );
}

function renderBox(initialEntries: string[] = ['/app']) {
  return render(
    <QueryClientProvider client={createTestQueryClient()}>
      <MemoryRouter initialEntries={initialEntries}>
        <HeaderSearchBox />
        <LocationDisplay />
        <GoToWishlistButton />
        <GoBackButton />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

// --- 069 US1 helpers -------------------------------------------------------
// The expanded/collapsed state is read through what the collector can
// perceive: the decorative backdrop (contracts/header-search-ui.md §2) and
// the opener's `aria-expanded` (§3) — never through component internals.

/** The backdrop, or null while the search is collapsed. */
function scrim(): HTMLElement | null {
  return document.querySelector<HTMLElement>('div.overlay-scrim');
}

/** The control that opens the search — the only "Search" button carrying `aria-expanded`. */
function opener(expanded: boolean): HTMLElement {
  return screen.getByRole('button', { name: /search/i, expanded });
}

function searchField(): HTMLInputElement {
  return screen.getByRole('combobox', { name: /search discogs/i });
}

describe('HeaderSearchBox', () => {
  it('renders the search field, exposed as a combobox (069 US3)', () => {
    renderBox();

    expect(screen.getByRole('combobox', { name: /search discogs/i })).toBeInTheDocument();
  });

  it('the submit control inherits the shared pressed-state from Button (US1)', () => {
    renderBox();

    expect(screen.getByRole('button', { name: /search/i }).className).toMatch(
      /active:scale-\[0\.97\]/,
    );
  });

  it('navigates to the search results page with the trimmed query on submit', async () => {
    const user = userEvent.setup();
    renderBox(['/app']);

    await user.type(
      screen.getByRole('combobox', { name: /search discogs/i }),
      '  stockholm  ',
    );
    await user.click(screen.getByRole('button', { name: /search/i }));

    expect(screen.getByTestId('location')).toHaveTextContent('/app/search?q=stockholm');
  });

  it('from 640 px up, typing into the Tab-focused field activates the search without selecting what is typed, and Enter submits it (contracts §1)', async () => {
    const wide = vi.spyOn(window, 'matchMedia').mockImplementation(
      (query: string) =>
        ({
          matches: query === '(min-width: 640px)',
          media: query,
          addEventListener: () => {},
          removeEventListener: () => {},
        }) as unknown as MediaQueryList,
    );
    const user = userEvent.setup();
    renderBox(['/app']);

    await user.tab();
    await user.keyboard('stockholm');
    expect(opener(true)).toBeInTheDocument();
    expect(searchField()).toHaveValue('stockholm');
    await user.keyboard('{Enter}');

    expect(screen.getByTestId('location')).toHaveTextContent('/app/search?q=stockholm');
    wide.mockRestore();
  });

  it('from 640 px up, the Search button submits a query typed without clicking the field first (contracts §1)', async () => {
    const wide = vi.spyOn(window, 'matchMedia').mockImplementation(
      (query: string) =>
        ({
          matches: query === '(min-width: 640px)',
          media: query,
          addEventListener: () => {},
          removeEventListener: () => {},
        }) as unknown as MediaQueryList,
    );
    const user = userEvent.setup();
    renderBox(['/app']);

    // Keyboard focus (Tab) is not a click, so the field is never "activated".
    await user.tab();
    expect(searchField()).toHaveFocus();
    await user.keyboard('stockholm');
    await user.click(screen.getByRole('button', { name: /search/i }));

    expect(screen.getByTestId('location')).toHaveTextContent('/app/search?q=stockholm');
    wide.mockRestore();
  });

  it('from 640 px up, the Search button submits a pre-filled query the Tab-focused field holds, unedited (contracts §1)', async () => {
    const wide = vi.spyOn(window, 'matchMedia').mockImplementation(
      (query: string) =>
        ({
          matches: query === '(min-width: 640px)',
          media: query,
          addEventListener: () => {},
          removeEventListener: () => {},
        }) as unknown as MediaQueryList,
    );
    const user = userEvent.setup();
    renderBox(['/app/search?q=miles&page=3']);

    await user.tab();
    expect(searchField()).toHaveFocus();
    await user.click(screen.getByRole('button', { name: /search/i }));

    // A submit restarts at page 1; opening would have left the URL alone.
    expect(screen.getByTestId('location')).toHaveTextContent(/^\/app\/search\?q=miles$/);
    expect(scrim()).toBeNull();
    wide.mockRestore();
  });

  it('does not navigate when the query is empty or whitespace-only', async () => {
    const user = userEvent.setup();
    renderBox(['/app']);

    await user.type(screen.getByRole('combobox', { name: /search discogs/i }), '   ');
    await user.click(screen.getByRole('button', { name: /search/i }));

    expect(screen.getByTestId('location')).toHaveTextContent('/app');
    expect(screen.getByTestId('location')).not.toHaveTextContent('/app/search');
  });

  it('initializes the input from the q param when mounted on the results page', () => {
    renderBox(['/app/search?q=miles+davis']);

    expect(screen.getByRole('combobox', { name: /search discogs/i })).toHaveValue(
      'miles davis',
    );
  });

  it('resets to empty when navigating away from the results page', async () => {
    const user = userEvent.setup();
    renderBox(['/app/search?q=stockholm']);

    const input = screen.getByRole('combobox', { name: /search discogs/i });
    expect(input).toHaveValue('stockholm');

    await user.click(screen.getByRole('button', { name: /go to wishlist/i }));

    expect(screen.getByTestId('location')).toHaveTextContent('/app/wishlist');
    expect(input).toHaveValue('');
  });
});

describe('HeaderSearchBox — activation, dismissal and submission (069 US1)', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('expands and hands the field DOM focus on a single activation, with no second interaction (FR-002, FR-003, SC-001)', async () => {
    const user = userEvent.setup();
    renderBox();

    await user.click(opener(false));

    expect(searchField()).toHaveFocus();
    expect(opener(true)).toHaveAttribute('aria-expanded', 'true');
    expect(scrim()).not.toBeNull();
  });

  it('pre-fills and selects the query in effect on the results screen, without looking anything up (FR-004, clarification 4)', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    const user = userEvent.setup();
    renderBox(['/app/search?q=miles+davis']);

    await user.click(opener(false));

    const field = searchField();
    expect(field).toHaveValue('miles davis');
    // Selected, so one keystroke replaces it: `select()` after `focus()`.
    expect(field.selectionStart).toBe(0);
    expect(field.selectionEnd).toBe('miles davis'.length);
    // `hasEdited` is still false: no panel, no lookup, however long the pre-fill.
    expect(screen.queryByRole('listbox')).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('renders a decorative blurred backdrop that collapses the search when activated (FR-002, FR-007)', async () => {
    const user = userEvent.setup();
    renderBox();

    await user.click(opener(false));

    const backdrop = scrim();
    expect(backdrop).not.toBeNull();
    expect(backdrop).toHaveAttribute('aria-hidden', 'true');
    expect(backdrop).toHaveClass('fixed', 'inset-0', 'z-30', 'backdrop-blur-xl');

    await user.click(backdrop as HTMLElement);

    expect(scrim()).toBeNull();
  });

  it('collapses on Escape with no panel open and returns focus to the control that opened it (FR-007)', async () => {
    const user = userEvent.setup();
    renderBox();

    const control = opener(false);
    await user.click(control);
    await user.keyboard('{Escape}');

    expect(scrim()).toBeNull();
    expect(opener(false)).toHaveFocus();
  });

  it('collapses when focus leaves the search, but not when it moves within it (FR-007, at every width)', async () => {
    const user = userEvent.setup();
    renderBox();

    await user.click(opener(false));

    // Focus moving to the submit button stays inside the search container.
    fireEvent.focusOut(searchField(), {
      relatedTarget: document.querySelector('button[type="submit"]'),
    });
    expect(scrim()).not.toBeNull();

    fireEvent.focusOut(searchField(), {
      relatedTarget: screen.getByRole('button', { name: /go to wishlist/i }),
    });
    expect(scrim()).toBeNull();
  });

  it('collapsing resets the search: no panel on re-opening, empty announcement region, page scrolling released (FR-007, FR-015)', async () => {
    const user = userEvent.setup();
    renderBox();

    await user.click(opener(false));
    await user.type(searchField(), 'coltrane');
    await user.keyboard('{Escape}');

    expect(document.body.style.overflow).not.toBe('hidden');
    expect(screen.getByRole('status')).toHaveTextContent('');

    // `hasEdited` was cleared on collapse, so re-activating with 2+
    // characters still in the field shows no panel (research D10). US1 has no
    // panel to assert against, so the announcement region standing in for it is
    // all that is checkable here; the `combobox`/`aria-expanded` wiring that
    // makes this observable arrives with US3 (T031, T035).
    await user.click(opener(false));
    expect(screen.getByRole('status')).toHaveTextContent('');
  });

  it("submits with today's navigation contract — filters re-applied, entry replaced — and then collapses (FR-008)", async () => {
    const user = userEvent.setup();
    renderBox(['/app', '/app/search?q=jazz&format=Vinyl']);

    await user.click(opener(false));
    await user.clear(searchField());
    await user.type(searchField(), 'blue train{Enter}');

    expect(screen.getByTestId('location')).toHaveTextContent(
      '/app/search?q=blue+train&format=Vinyl',
    );
    expect(scrim()).toBeNull();

    // `{ replace: true }` on the results screen: back goes to /app, not to
    // the previous results entry.
    await user.click(screen.getByRole('button', { name: /go back/i }));
    expect(screen.getByTestId('location')).toHaveTextContent('/app');
  });
});

describe('HeaderSearchBox — debounced, gated suggestion lookups (069 US2)', () => {
  const SUGGESTION: CatalogSuggestion = {
    discogsId: 1,
    resultType: 'master',
    title: 'Blue Train',
    artist: 'John Coltrane',
    year: 1957,
    format: 'Vinyl',
    thumbnailUrl: 'https://example.com/blue-train.jpg',
  };

  /**
   * Real timers throughout. A fake clock cannot be used here: RTL's async
   * wrapper awaits a real `setTimeout(0)` that it only auto-advances under
   * Jest, so faking `setTimeout` deadlocks every `userEvent` call. What keeps
   * these deterministic instead is the debounce itself — every keystroke
   * restarts it, so a 50 ms typing rhythm can never let it fire mid-word.
   */
  const KEYSTROKE_MS = 50;
  /** Comfortably past the 300 ms debounce, for asserting a *negative*. */
  const AFTER_DEBOUNCE_MS = 600;

  function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => {
      setTimeout(resolve, ms);
    });
  }

  beforeEach(() => {
    mockSuggest.mockReset();
    mockSuggest.mockResolvedValue([SUGGESTION]);
  });

  it('looks nothing up while the collector is still typing, and at most 3 times across a 10-character query (FR-010, SC-004)', async () => {
    const user = userEvent.setup({ delay: KEYSTROKE_MS });
    renderBox();

    await user.click(opener(false));
    await user.type(searchField(), 'coltrane78');

    // Typing continuously produces none: the pause never arrives.
    expect(mockSuggest).not.toHaveBeenCalled();

    await waitFor(() => expect(mockSuggest).toHaveBeenCalled(), { timeout: 2000 });
    expect(mockSuggest.mock.calls.length).toBeLessThanOrEqual(3);
  });

  it('turns a pasted query into exactly one lookup (FR-010, spec edge case)', async () => {
    const user = userEvent.setup();
    renderBox();

    await user.click(opener(false));
    await user.paste('john coltrane blue train');
    await sleep(AFTER_DEBOUNCE_MS);

    expect(mockSuggest).toHaveBeenCalledTimes(1);
    expect(mockSuggest).toHaveBeenCalledWith('john coltrane blue train');
  });

  it('looks nothing up for a single non-whitespace character (FR-010)', async () => {
    const user = userEvent.setup();
    renderBox();

    await user.click(opener(false));
    await user.type(searchField(), ' m ');
    await sleep(AFTER_DEBOUNCE_MS);

    expect(mockSuggest).not.toHaveBeenCalled();
  });

  it('looks nothing up for a pre-filled query until the collector actually edits it (FR-004, clarification 4)', async () => {
    const user = userEvent.setup();
    renderBox(['/app/search?q=miles+davis']);

    await user.click(opener(false));
    await sleep(AFTER_DEBOUNCE_MS);

    // `hasEdited` is false: activation alone never costs a request, however
    // long the query already in the field.
    expect(mockSuggest).not.toHaveBeenCalled();

    // The first real edit lifts the gate.
    await user.type(searchField(), 'coltrane');
    await waitFor(() => expect(mockSuggest).toHaveBeenCalled(), { timeout: 2000 });

    expect(mockSuggest).toHaveBeenCalledWith(searchField().value.trim());
  });

  it('closes the panel, drops the outstanding lookup and clears the announcement when the field is emptied (FR-015)', async () => {
    const user = userEvent.setup();
    renderBox();

    await user.click(opener(false));
    await user.type(searchField(), 'coltrane');
    expect(
      await screen.findByRole('listbox', undefined, { timeout: 2000 }),
    ).toBeInTheDocument();

    await user.clear(searchField());

    await waitFor(() => expect(screen.queryByRole('listbox')).toBeNull());
    expect(screen.getByRole('status')).toHaveTextContent('');
    expect(mockSuggest).not.toHaveBeenCalledWith('');
  });
});

describe('HeaderSearchBox — combobox semantics, keyboard model and announcements (069 US3)', () => {
  // Artists first, then albums (assumption 4) — the order the panel receives
  // is the order the arrow keys walk.
  const ARTIST: CatalogSuggestion = {
    discogsId: 7,
    resultType: 'artist',
    title: 'John Coltrane',
    thumbnailUrl: 'https://example.com/coltrane.jpg',
  };
  const MASTER: CatalogSuggestion = {
    discogsId: 11,
    resultType: 'master',
    title: 'Blue Train',
    artist: 'John Coltrane',
    year: 1957,
    format: 'Vinyl',
    thumbnailUrl: 'https://example.com/blue-train.jpg',
  };
  const RELEASE: CatalogSuggestion = {
    discogsId: 22,
    resultType: 'release',
    title: 'Giant Steps',
    artist: 'John Coltrane',
    year: 1960,
    format: 'Vinyl',
    thumbnailUrl: 'https://example.com/giant-steps.jpg',
  };
  const THREE = [ARTIST, MASTER, RELEASE];

  /** Comfortably past the 300 ms debounce, for asserting a *negative*. */
  const AFTER_DEBOUNCE_MS = 600;

  function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => {
      setTimeout(resolve, ms);
    });
  }

  beforeEach(() => {
    mockSuggest.mockReset();
    mockSuggest.mockResolvedValue(THREE);
  });

  function announcement(): HTMLElement {
    // Exactly one region, never one per state (contracts §5).
    const regions = screen.getAllByRole('status');
    expect(regions).toHaveLength(1);
    return regions[0];
  }

  /** The id in `aria-activedescendant`, or null when no option is active. */
  function activeOptionId(): string | null {
    return searchField().getAttribute('aria-activedescendant') || null;
  }

  /**
   * "No active option" is one state with two halves: nothing referenced from
   * the field, and nothing selected in the list (contracts §4).
   */
  function expectNoActiveOption(): void {
    expect(activeOptionId()).toBeNull();
    expect(screen.queryAllByRole('option', { selected: true })).toHaveLength(0);
  }

  /** Activates the search and types until the panel holds the three suggestions. */
  async function openWithSuggestions(
    user: ReturnType<typeof userEvent.setup>,
  ): Promise<void> {
    await user.click(opener(false));
    await user.type(searchField(), 'coltrane');
    await waitFor(() => expect(screen.getAllByRole('option')).toHaveLength(3), {
      timeout: 2000,
    });
  }

  it('exposes the field as a combobox wired to the suggestion listbox, with its name unchanged (FR-024, contracts §3)', async () => {
    const user = userEvent.setup();
    renderBox();

    await user.click(opener(false));

    const field = searchField();
    expect(field).toHaveAccessibleName('Search Discogs');
    expect(field).toHaveAttribute('type', 'search');
    expect(field).toHaveAttribute('aria-autocomplete', 'list');
    expect(field).toHaveAttribute('aria-controls', 'header-search-listbox');
    // A combobox is not a searchbox: the explicit role replaces the implicit
    // one, and only the combobox contract is exposed (research D11).
    expect(screen.queryByRole('searchbox')).toBeNull();
    // No panel yet, so nothing is expanded and nothing is active.
    expect(field).toHaveAttribute('aria-expanded', 'false');
    expectNoActiveOption();
  });

  it('reports aria-expanded only while the suggestion panel is displayed (FR-024, contracts §3)', async () => {
    const user = userEvent.setup();
    renderBox();

    await openWithSuggestions(user);
    expect(searchField()).toHaveAttribute('aria-expanded', 'true');

    await user.clear(searchField());

    await waitFor(() => expect(screen.queryByRole('listbox')).toBeNull());
    expect(searchField()).toHaveAttribute('aria-expanded', 'false');
  });

  it('walks the list with the arrows by moving aria-activedescendant only, never DOM focus (FR-021, FR-022, contracts §4)', async () => {
    const user = userEvent.setup();
    renderBox();

    await openWithSuggestions(user);
    const field = searchField();

    for (const index of [0, 1, 2]) {
      await user.keyboard('{ArrowDown}');
      expect(activeOptionId()).toBe(`header-search-option-${index}`);
      // The one property that removes the need for a focus trap: the input
      // keeps DOM focus at *every* step (research D11, clarification 3).
      expect(document.activeElement).toBe(field);
      const [selected] = screen.getAllByRole('option', { selected: true });
      expect(selected).toHaveAttribute('id', `header-search-option-${index}`);
    }
  });

  it('returns to no active option past the last one instead of wrapping (assumption 5, contracts §4)', async () => {
    const user = userEvent.setup();
    renderBox();

    await openWithSuggestions(user);

    await user.keyboard('{ArrowDown}{ArrowDown}{ArrowDown}');
    expect(activeOptionId()).toBe('header-search-option-2');

    await user.keyboard('{ArrowDown}');
    expectNoActiveOption();
    expect(document.activeElement).toBe(searchField());

    // And the next press starts the list again from the top.
    await user.keyboard('{ArrowDown}');
    expect(activeOptionId()).toBe('header-search-option-0');
  });

  it('activates the last option with ArrowUp from none, and returns to none before the first (assumption 5, contracts §4)', async () => {
    const user = userEvent.setup();
    renderBox();

    await openWithSuggestions(user);

    await user.keyboard('{ArrowUp}');
    expect(activeOptionId()).toBe('header-search-option-2');
    expect(document.activeElement).toBe(searchField());

    await user.keyboard('{ArrowUp}{ArrowUp}');
    expect(activeOptionId()).toBe('header-search-option-0');

    await user.keyboard('{ArrowUp}');
    expectNoActiveOption();
  });

  it('opens the active option with Enter, by its resultType, and collapses (FR-022, contracts §4, §6)', async () => {
    const user = userEvent.setup();
    renderBox();

    await openWithSuggestions(user);

    // Second option: the master. Its destination is /app/masters/:discogsId.
    await user.keyboard('{ArrowDown}{ArrowDown}{Enter}');

    expect(screen.getByTestId('location')).toHaveTextContent('/app/masters/11');
    expect(scrim()).toBeNull();
  });

  it('submits the typed query with Enter whenever no option is active, including after arrowing off the end (FR-022, assumption 5)', async () => {
    const user = userEvent.setup();
    renderBox();

    await openWithSuggestions(user);

    // Four presses over three options: off the end, back to "no active option".
    await user.keyboard('{ArrowDown}{ArrowDown}{ArrowDown}{ArrowDown}');
    expectNoActiveOption();

    await user.keyboard('{Enter}');

    expect(screen.getByTestId('location')).toHaveTextContent('/app/search?q=coltrane');
    expect(scrim()).toBeNull();
  });

  it('closes the panel on the first Escape keeping text and focus, and collapses on the second (FR-022, contracts §1, §4)', async () => {
    const user = userEvent.setup();
    renderBox();

    const control = opener(false);
    await openWithSuggestions(user);

    await user.keyboard('{Escape}');

    expect(screen.queryByRole('listbox')).toBeNull();
    const field = searchField();
    expect(field).toHaveValue('coltrane');
    expect(field).toHaveFocus();
    expect(field).toHaveAttribute('aria-expanded', 'false');
    // Still expanded: only the panel closed.
    expect(scrim()).not.toBeNull();

    await user.keyboard('{Escape}');

    expect(scrim()).toBeNull();
    expect(control).toHaveFocus();
  });

  it('announces the lookup and then the number of suggestions, politely and in one region (FR-023, contracts §5)', async () => {
    let settle: (suggestions: CatalogSuggestion[]) => void = () => {};
    mockSuggest.mockImplementation(
      () =>
        new Promise<CatalogSuggestion[]>((resolve) => {
          settle = resolve;
        }),
    );
    const user = userEvent.setup();
    renderBox();

    await user.click(opener(false));
    await user.type(searchField(), 'coltrane');

    await waitFor(() => expect(announcement().textContent).toBe('Searching…'), {
      timeout: 2000,
    });

    settle(THREE);

    await waitFor(() =>
      expect(announcement().textContent).toBe('3 suggestions available.'),
    );
  });

  it('announces a lone suggestion in the singular (contracts §5)', async () => {
    mockSuggest.mockResolvedValue([MASTER]);
    const user = userEvent.setup();
    renderBox();

    await user.click(opener(false));
    await user.type(searchField(), 'coltrane');

    await waitFor(
      () => expect(announcement().textContent).toBe('1 suggestion available.'),
      { timeout: 2000 },
    );
  });

  it('announces nothing when the search is activated with a pre-filled query (FR-004, contracts §5)', async () => {
    const user = userEvent.setup();
    renderBox(['/app/search?q=miles+davis']);

    await user.click(opener(false));
    await sleep(AFTER_DEBOUNCE_MS);

    // No lookup runs, so there is nothing to say — not even "Searching…" —
    // and nothing is expanded for it to be said about.
    expect(mockSuggest).not.toHaveBeenCalled();
    expect(announcement().textContent).toBe('');
    expect(searchField()).toHaveAttribute('aria-expanded', 'false');
    expectNoActiveOption();
  });
});

// Safari (macOS and iOS) never focuses a button on click, and no browser
// focuses panel padding or message text: an un-prevented mousedown there drops
// focus to <body>, so the field's `focusout` carries `relatedTarget: null`
// before `click` fires (contracts §1, §3).
describe('HeaderSearchBox — pointer presses that do not move focus (069 US1, US4)', () => {
  beforeEach(() => {
    mockSuggest.mockReset();
    mockSuggest.mockResolvedValue([]);
  });

  /** A press the way Safari delivers it. */
  function safariPress(target: HTMLElement): void {
    if (fireEvent.mouseDown(target)) {
      act(() => (document.activeElement as HTMLElement | null)?.blur());
    }
    fireEvent.mouseUp(target);
    fireEvent.click(target);
  }

  it('submits from the expanded bar Search button instead of collapsing and re-opening', async () => {
    const user = userEvent.setup();
    renderBox();

    await user.click(opener(false));
    await user.type(searchField(), 'miles');
    safariPress(opener(true));

    expect(screen.getByTestId('location')).toHaveTextContent('/app/search?q=miles');
  });

  it('stays expanded when the panel padding or its message is pressed', async () => {
    const user = userEvent.setup();
    renderBox();

    await user.click(opener(false));
    await user.type(searchField(), 'zzqx');
    const message = await screen.findByText(/try fewer or different words/i, undefined, {
      timeout: 2000,
    });

    safariPress(message);
    expect(scrim()).not.toBeNull();
    safariPress(screen.getByTestId('header-search-panel'));
    expect(scrim()).not.toBeNull();
    expect(searchField()).toHaveFocus();
  });

  it('re-runs the lookup when Retry is pressed', async () => {
    mockSuggest.mockRejectedValue(new ApiError('Upstream failed', 502, 'upstream_error'));
    const user = userEvent.setup();
    renderBox();

    await user.click(opener(false));
    await user.type(searchField(), 'miles');
    const retry = await screen.findByRole('button', { name: 'Retry' }, { timeout: 2000 });
    const calls = mockSuggest.mock.calls.length;

    safariPress(retry);

    await waitFor(() => expect(mockSuggest.mock.calls.length).toBeGreaterThan(calls));
    expect(scrim()).not.toBeNull();
  });
});
