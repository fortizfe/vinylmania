import { render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { HeaderSuggestionPanel } from '../../src/components/HeaderSuggestionPanel';
import type { CatalogSuggestion } from '../../src/services/discogsApi';

// 069 US2 — the panel's `idle`, `loading` and `suggestions` states
// (data-model.md §5). `empty` and `error` are US4's (T038), further down.

/**
 * The row height is what makes SC-008's "the panel does not change size
 * between its loading and loaded states" checkable in jsdom, where every box
 * measures 0. A fixed row-height class on every `<li>` — skeleton or real —
 * is the assertable form of "same shape and height" (FR-014, contracts §7).
 */
const ROW_HEIGHT_CLASS = 'h-14';

const ALBUM: CatalogSuggestion = {
  discogsId: 1,
  resultType: 'master',
  title: 'Kind Of Blue',
  artist: 'Miles Davis',
  year: 1959,
  format: 'Vinyl',
  thumbnailUrl: 'https://example.com/kind-of-blue.jpg',
};

const ARTIST: CatalogSuggestion = {
  discogsId: 2,
  resultType: 'artist',
  title: 'Miles Davis',
  thumbnailUrl: 'https://example.com/miles-davis.jpg',
};

function fiveAlbums(): CatalogSuggestion[] {
  return Array.from({ length: 5 }, (_unused, index) => ({
    ...ALBUM,
    discogsId: index + 1,
    title: `Album ${index + 1}`,
  }));
}

function listbox(): HTMLElement {
  return screen.getByRole('listbox', { name: /search suggestions/i });
}

function rows(): HTMLLIElement[] {
  return Array.from(listbox().querySelectorAll('li'));
}

describe('HeaderSuggestionPanel (069 US2)', () => {
  it('renders nothing while idle (data-model §5)', () => {
    const { container } = render(
      <HeaderSuggestionPanel state="idle" onSelect={vi.fn()} />,
    );

    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('fills the listbox with five decorative skeleton rows and exposes no options while loading (FR-014)', () => {
    render(<HeaderSuggestionPanel state="loading" onSelect={vi.fn()} />);

    const skeletons = rows();
    expect(skeletons).toHaveLength(5);
    for (const skeleton of skeletons) {
      expect(skeleton).toHaveAttribute('role', 'presentation');
      expect(skeleton).toHaveAttribute('aria-hidden', 'true');
      expect(skeleton).toHaveClass(
        'bg-stone-200',
        // Not `dark:bg-surface-raised`: that is the Card's own dark surface,
        // so the skeleton measured 1.00:1 against the panel (FR-025, T034).
        'dark:bg-border-dark',
        'animate-pulse',
        'rounded-md',
      );
    }

    // The placeholders are not results: the count lives in the announcement
    // region, never in the listbox (contracts §3).
    expect(within(listbox()).queryAllByRole('option')).toHaveLength(0);
  });

  it('labels every suggestion with its primary label, its secondary detail and its kind as text (FR-011, FR-025)', () => {
    render(
      <HeaderSuggestionPanel
        state="suggestions"
        suggestions={[ALBUM, ARTIST]}
        onSelect={vi.fn()}
      />,
    );

    const [albumRow, artistRow] = rows();

    expect(within(albumRow).getByText('Kind Of Blue')).toBeInTheDocument();
    expect(albumRow).toHaveTextContent('Miles Davis');
    expect(albumRow).toHaveTextContent('1959');
    expect(albumRow).toHaveTextContent('Vinyl');
    // Queried by text, so the label is readable with every colour stripped —
    // the kind is never carried by colour alone (FR-025).
    expect(within(albumRow).getByText('Album')).toBeInTheDocument();

    expect(within(artistRow).getByText('Miles Davis')).toBeInTheDocument();
    expect(within(artistRow).getByText('Artist')).toBeInTheDocument();
  });

  it('keeps the same panel height between its loading and loaded states (FR-014, SC-008)', () => {
    const { unmount } = render(
      <HeaderSuggestionPanel state="loading" onSelect={vi.fn()} />,
    );
    const loadingRows = rows();
    expect(loadingRows).toHaveLength(5);
    for (const row of loadingRows) {
      expect(row).toHaveClass(ROW_HEIGHT_CLASS);
    }
    unmount();

    render(
      <HeaderSuggestionPanel
        state="suggestions"
        suggestions={fiveAlbums()}
        onSelect={vi.fn()}
      />,
    );
    const loadedRows = rows();
    expect(loadedRows).toHaveLength(loadingRows.length);
    for (const row of loadedRows) {
      expect(row).toHaveClass(ROW_HEIGHT_CLASS);
    }
  });

  it('floats on the shared Card surface rather than on a SearchResultCard (research D16)', () => {
    const { container } = render(
      <HeaderSuggestionPanel
        state="suggestions"
        suggestions={[ALBUM]}
        onSelect={vi.fn()}
      />,
    );

    const panel = screen.getByTestId('header-search-panel');
    // Card's own surface classes plus the floating elevation (contracts §7).
    expect(panel).toHaveClass('rounded-xl', 'border', 'bg-stone-50', 'shadow-lg');
    expect(listbox()).toHaveAttribute('id', 'header-search-listbox');

    // SearchResultCard is a `<Link>`-wrapped result card; a listbox row is not
    // a link, and choosing one is handled by the panel's own callback.
    expect(container.querySelector('a')).toBeNull();
  });
});

// 069 US3 — the listbox half of the combobox pattern (contracts §3, research
// D11). The field owns `aria-activedescendant`; the panel owns the ids it
// points at and the `aria-selected` state it mirrors.
describe('HeaderSuggestionPanel — listbox semantics (069 US3)', () => {
  function options(): HTMLElement[] {
    return within(listbox()).getAllByRole('option');
  }

  it('exposes every suggestion as an option addressed by its index (contracts §3)', () => {
    render(
      <HeaderSuggestionPanel
        state="suggestions"
        suggestions={[ARTIST, ALBUM]}
        onSelect={vi.fn()}
      />,
    );

    const rendered = options();
    expect(rendered).toHaveLength(2);
    // The ids are the contract `aria-activedescendant` is written against, so
    // they are positional, not keyed on the Discogs id.
    rendered.forEach((option, index) => {
      expect(option).toHaveAttribute('id', `header-search-option-${index}`);
      expect(option.tagName).toBe('LI');
    });
  });

  it('names each option by its title, its secondary detail and its kind (contracts §3, FR-025)', () => {
    render(
      <HeaderSuggestionPanel
        state="suggestions"
        suggestions={[ALBUM, ARTIST]}
        onSelect={vi.fn()}
      />,
    );

    const [albumOption, artistOption] = options();
    expect(albumOption).toHaveAccessibleName(
      'Kind Of Blue, Miles Davis · 1959 · Vinyl, Album',
    );
    // An artist row carries no secondary detail, so its name is the two parts
    // it does have — never a dangling separator.
    expect(artistOption).toHaveAccessibleName('Miles Davis, Artist');
  });

  it('marks the active option as selected, and only ever one (contracts §3, FR-022)', () => {
    render(
      <HeaderSuggestionPanel
        state="suggestions"
        suggestions={fiveAlbums()}
        activeIndex={2}
        onSelect={vi.fn()}
      />,
    );

    const selected = within(listbox()).getAllByRole('option', { selected: true });
    expect(selected).toHaveLength(1);
    expect(selected[0]).toHaveAttribute('id', 'header-search-option-2');
    expect(selected[0]).toHaveAccessibleName(/Album 3/);

    for (const option of options()) {
      if (option !== selected[0]) {
        expect(option).not.toHaveAttribute('aria-selected', 'true');
      }
    }
  });

  it('marks nothing as selected while no option is active (assumption 5)', () => {
    render(
      <HeaderSuggestionPanel
        state="suggestions"
        suggestions={fiveAlbums()}
        activeIndex={null}
        onSelect={vi.fn()}
      />,
    );

    expect(options()).toHaveLength(5);
    expect(within(listbox()).queryAllByRole('option', { selected: true })).toHaveLength(
      0,
    );
  });

  it('keeps the listbox mounted in every displayed state so aria-controls never dangles (contracts §3)', () => {
    const { unmount } = render(
      <HeaderSuggestionPanel state="loading" activeIndex={null} onSelect={vi.fn()} />,
    );

    expect(listbox()).toHaveAttribute('id', 'header-search-listbox');
    // Placeholders are decorative: there is nothing for the arrows to reach
    // and nothing for `aria-activedescendant` to point at while loading.
    expect(within(listbox()).queryAllByRole('option')).toHaveLength(0);
    unmount();

    render(
      <HeaderSuggestionPanel
        state="suggestions"
        suggestions={[ALBUM]}
        activeIndex={null}
        onSelect={vi.fn()}
      />,
    );

    expect(listbox()).toHaveAttribute('id', 'header-search-listbox');
    expect(options()).toHaveLength(1);
  });
});

// 069 US4 — the `empty` and `error` states (data-model.md §5, contracts §3).
// Both live inside the same Card but OUTSIDE the listbox, which stays mounted
// (and option-less) so the field's `aria-controls` never dangles.
describe('HeaderSuggestionPanel — empty and error states (069 US4)', () => {
  /**
   * Five rows (`h-14`, 3.5rem) plus the listbox's four `gap-1` gaps (0.25rem)
   * is 18.5rem — Tailwind's `h-74`. A message body of exactly that height is
   * the jsdom-assertable form of "the panel does not change size between
   * states" (SC-008), in the same spirit as ROW_HEIGHT_CLASS above.
   */
  const FIVE_ROW_BLOCK_HEIGHT_CLASS = 'h-74';

  function panel(): HTMLElement {
    return screen.getByTestId('header-search-panel');
  }

  it('names the searched text and suggests broadening it, outside the listbox, when nothing matches (FR-018)', () => {
    render(
      <HeaderSuggestionPanel
        state="empty"
        query="zzqx"
        onSelect={vi.fn()}
        onRetry={vi.fn()}
      />,
    );

    const message = screen.getByText(/zzqx/);
    expect(message.tagName).toBe('P');
    expect(message).toHaveTextContent(
      /fewer|shorter|different|broader|check the spelling/i,
    );
    expect(panel()).toContainElement(message);
    expect(listbox()).not.toContainElement(message);

    // The listbox stays mounted with nothing for the arrows to reach.
    expect(within(listbox()).queryAllByRole('option')).toHaveLength(0);
    expect(screen.queryByRole('button', { name: /retry/i })).toBeNull();
  });

  it('shows a message and a Retry button outside the listbox when the lookup failed (FR-019)', async () => {
    const onRetry = vi.fn();
    render(
      <HeaderSuggestionPanel
        state="error"
        query="miles"
        onSelect={vi.fn()}
        onRetry={onRetry}
      />,
    );

    const retry = screen.getByRole('button', { name: 'Retry' });
    expect(retry.tagName).toBe('BUTTON');
    // WCAG 2.5.5-style 44×44 target (T042, T041).
    expect(retry).toHaveClass('min-h-11', 'min-w-11');
    expect(panel()).toContainElement(retry);
    expect(listbox()).not.toContainElement(retry);

    const message = panel().querySelector('p');
    expect(message).not.toBeNull();
    expect(message).toHaveTextContent(/unavailable|couldn.t|could not|failed/i);
    expect(listbox()).not.toContainElement(message);
    expect(within(listbox()).queryAllByRole('option')).toHaveLength(0);

    retry.click();
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('never interrupts with role="alert" — the failure is announced politely by the field (FR-023)', () => {
    render(
      <HeaderSuggestionPanel
        state="error"
        query="miles"
        onSelect={vi.fn()}
        onRetry={vi.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
    expect(screen.queryByRole('alert')).toBeNull();
    expect(panel().querySelector('[aria-live="assertive"]')).toBeNull();
  });

  it.each(['empty', 'error'] as const)(
    'keeps the loading and loaded panel height in the %s state (SC-008)',
    (state) => {
      const { unmount } = render(
        <HeaderSuggestionPanel state="loading" onSelect={vi.fn()} onRetry={vi.fn()} />,
      );
      const loadingPanelClass = panel().className;
      unmount();

      render(
        <HeaderSuggestionPanel
          state={state}
          query="zzqx"
          onSelect={vi.fn()}
          onRetry={vi.fn()}
        />,
      );

      // Same surface, same padding, same width…
      expect(panel().className).toBe(loadingPanelClass);
      // …and a message body exactly as tall as the five-row block.
      const message = panel().querySelector('p');
      expect(message).not.toBeNull();
      const block = message!.closest(`.${FIVE_ROW_BLOCK_HEIGHT_CLASS}`);
      expect(block).not.toBeNull();
      expect(panel()).toContainElement(block as HTMLElement);
    },
  );

  it('replaces rather than stacks the message across consecutive failures (FR-019)', () => {
    const props = { query: 'miles', onSelect: vi.fn(), onRetry: vi.fn() };
    const { rerender } = render(<HeaderSuggestionPanel state="error" {...props} />);

    // Retry → loading → a second failure.
    rerender(<HeaderSuggestionPanel state="loading" {...props} />);
    rerender(<HeaderSuggestionPanel state="error" {...props} />);

    expect(screen.getAllByRole('button', { name: 'Retry' })).toHaveLength(1);
    expect(panel().querySelectorAll('p')).toHaveLength(1);
  });
});
