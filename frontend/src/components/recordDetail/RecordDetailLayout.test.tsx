import type { ComponentProps } from 'react';
import { act, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { RecordDetailLayout } from './RecordDetailLayout';

/**
 * Each slot is filled with an identifiable node carrying `data-slot`. Reading
 * them back in document order lets us assert the DOM order is exactly the
 * contracts/ui-contracts.md §C1 order — the same single tree for the mobile
 * stack and the desktop rail (the component is CSS-only responsive, so there
 * is one tree and the order is invariant; we never touch jsdom media queries).
 */
function slot(name: string) {
  return <div data-slot={name}>{name}</div>;
}

function renderLayout(
  overrides: Partial<ComponentProps<typeof RecordDetailLayout>> = {},
) {
  return render(
    <MemoryRouter>
      <RecordDetailLayout
        backTo="/app/search"
        actions={slot('actions')}
        gallery={slot('gallery')}
        generalInfo={slot('generalInfo')}
        rating={slot('rating')}
        streaming={slot('streaming')}
        tracklist={slot('tracklist')}
        catalogInfo={slot('catalogInfo')}
        {...overrides}
      />
    </MemoryRouter>,
  );
}

function slotOrder(): string[] {
  return Array.from(document.querySelectorAll<HTMLElement>('[data-slot]')).map(
    (el) => el.dataset.slot ?? '',
  );
}

describe('RecordDetailLayout', () => {
  it('renders the slot wrappers in the §C1 DOM order (no myCopy)', () => {
    renderLayout();

    expect(slotOrder()).toEqual([
      'actions',
      'gallery',
      'generalInfo',
      'rating',
      'streaming',
      'tracklist',
      'catalogInfo',
    ]);
  });

  it('renders each slot exactly once — one tree for mobile and desktop', () => {
    renderLayout({ myCopy: slot('myCopy') });

    for (const name of [
      'actions',
      'gallery',
      'generalInfo',
      'myCopy',
      'rating',
      'streaming',
      'tracklist',
      'catalogInfo',
    ]) {
      expect(document.querySelectorAll(`[data-slot="${name}"]`)).toHaveLength(1);
    }
  });

  it('omits the "estado de mi copia" wrapper when myCopy is not provided', () => {
    renderLayout();

    expect(document.querySelector('[data-slot="myCopy"]')).toBeNull();
    expect(slotOrder()).not.toContain('myCopy');
  });

  it('places the myCopy wrapper between generalInfo and rating in the DOM', () => {
    renderLayout({ myCopy: slot('myCopy') });

    expect(slotOrder()).toEqual([
      'actions',
      'gallery',
      'generalInfo',
      'myCopy',
      'rating',
      'streaming',
      'tracklist',
      'catalogInfo',
    ]);
  });

  it('renders the actions wrapper as the first child after the back-link', () => {
    renderLayout();

    const main = screen.getByRole('main');
    const children = Array.from(main.children);

    // The back-link is the first child (a router <a>).
    expect(children[0].tagName).toBe('A');

    // The actions wrapper is the next child and contains the actions node.
    const actionsWrapper = children[1] as HTMLElement;
    expect(within(actionsWrapper).getByText('actions')).toBeInTheDocument();

    // The layout grid follows the actions wrapper.
    expect(children[2]).toHaveAttribute('data-testid', 'record-detail-layout');
  });

  it('does not use CSS `order-*` utilities to rearrange sections (FR-022)', () => {
    renderLayout({ myCopy: slot('myCopy') });

    const withOrder = Array.from(document.querySelectorAll<HTMLElement>('*')).filter(
      (el) =>
        Array.from(el.classList).some(
          (c) => /(?:^|:)-?order-/.test(c) || /(?:^|:)order-(first|last|none)$/.test(c),
        ),
    );
    expect(withOrder).toEqual([]);
  });
});

/**
 * Feature 065 (US1, T003): rail-column slots (gallery/rating/streaming) must
 * be positioned independently of content-column (generalInfo/myCopy/
 * tracklist/catalogInfo) slot heights on desktop, via the
 * `useIndependentColumnLayout` hook — never via shared CSS Grid rows (see
 * research.md R1/R3). This describe block installs its own `matchMedia` /
 * `ResizeObserver` stubs and restores them afterward; it must not affect the
 * DOM-order tests above, which keep passing unmodified against the default
 * (mobile, `matches: false`) stub from tests/setup.ts.
 */
describe('RecordDetailLayout — independent column positioning (feature 065, US1)', () => {
  interface MockResizeObserverInstance {
    callback: ResizeObserverCallback;
    disconnect: ReturnType<typeof vi.fn>;
  }

  let roInstances: MockResizeObserverInstance[];

  beforeEach(() => {
    roInstances = [];

    class MockResizeObserver implements ResizeObserver {
      callback: ResizeObserverCallback;
      observe = vi.fn();
      unobserve = vi.fn();
      disconnect = vi.fn();

      constructor(callback: ResizeObserverCallback) {
        this.callback = callback;
        roInstances.push(this);
      }
    }
    vi.stubGlobal('ResizeObserver', MockResizeObserver);

    vi.spyOn(window, 'matchMedia').mockImplementation((query: string) => ({
      matches: true,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(() => false),
    }));
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  function fire(index: number, height: number) {
    act(() => {
      roInstances[index]?.callback(
        [{ contentRect: { height } } as ResizeObserverEntry],
        roInstances[index] as unknown as ResizeObserver,
      );
    });
  }

  it('positions rail-column slots independently of content-column slot heights', () => {
    renderLayout();

    // §C1 order (no myCopy): gallery(rail,0) generalInfo(content,1)
    // rating(rail,2) streaming(rail,3) tracklist(content,4) catalogInfo(content,5).
    fire(0, 40); // gallery
    fire(2, 60); // rating
    fire(4, 900); // tracklist — deliberately tall, in the CONTENT column

    const streamingWrapper = document.querySelector<HTMLElement>(
      '[data-slot="streaming"]',
    )?.parentElement;

    expect(streamingWrapper).not.toBeNull();
    // streaming sits right after gallery + rating in the rail column,
    // completely unaffected by the 900px-tall tracklist card next to it.
    expect(streamingWrapper?.style.top).toBe(`${40 + 24 + 60 + 24}px`);
  });

  it('does not reserve dead space in the content column to match the rail column', () => {
    renderLayout();

    fire(0, 900); // gallery — deliberately tall, in the RAIL column
    fire(1, 50); // generalInfo

    const tracklistWrapper = document.querySelector<HTMLElement>(
      '[data-slot="tracklist"]',
    )?.parentElement;

    // tracklist sits right after generalInfo in the content column,
    // unaffected by the 900px-tall gallery card next to it.
    expect(tracklistWrapper?.style.top).toBe(`${50 + 24}px`);
  });
});
