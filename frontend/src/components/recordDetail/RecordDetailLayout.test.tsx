import type { ComponentProps } from 'react';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

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
