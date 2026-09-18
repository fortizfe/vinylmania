import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { RecordDetailSkeleton } from './RecordDetailSkeleton';

function mockMatchMedia(matches: boolean) {
  vi.spyOn(window, 'matchMedia').mockImplementation((query: string) => ({
    matches,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(() => false),
  }));
}

/**
 * The skeleton must mirror the populated `RecordDetailLayout` footprint so the
 * skeleton → content swap causes no layout shift (UI Design System — "No layout
 * shift"; FR-021 / SC-008). We assert the structural blocks exist and carry
 * sizing classes (`w-*` / `h-*` / `min-h-*` / `aspect-*`) rather than snapshot
 * exact markup.
 */
function hasSizingClass(el: HTMLElement): boolean {
  return Array.from(el.querySelectorAll<HTMLElement>('*'))
    .concat(el)
    .some((node) =>
      Array.from(node.classList).some((c) =>
        /(?:^|:)(?:w-|h-|min-h-|min-w-|aspect-|size-)/.test(c),
      ),
    );
}

describe('RecordDetailSkeleton', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('keeps the record-detail-skeleton test id', () => {
    render(<RecordDetailSkeleton />);
    expect(screen.getByTestId('record-detail-skeleton')).toBeInTheDocument();
  });

  it('renders a block for every section of the populated layout', () => {
    render(<RecordDetailSkeleton />);

    for (const block of [
      'record-detail-skeleton-gallery',
      'record-detail-skeleton-general-info',
      'record-detail-skeleton-rating',
      'record-detail-skeleton-streaming',
      'record-detail-skeleton-tracklist',
      'record-detail-skeleton-catalog',
    ]) {
      expect(screen.getByTestId(block)).toBeInTheDocument();
    }
  });

  it('gives every section block a sizing class so the footprint is reserved', () => {
    render(<RecordDetailSkeleton />);

    for (const block of [
      'record-detail-skeleton-gallery',
      'record-detail-skeleton-general-info',
      'record-detail-skeleton-rating',
      'record-detail-skeleton-streaming',
      'record-detail-skeleton-tracklist',
      'record-detail-skeleton-catalog',
    ]) {
      expect(hasSizingClass(screen.getByTestId(block))).toBe(true);
    }
  });

  it('reserves a square footprint for the gallery like the populated cover', () => {
    render(<RecordDetailSkeleton />);
    const gallery = screen.getByTestId('record-detail-skeleton-gallery');
    const aspectNode = Array.from(gallery.querySelectorAll<HTMLElement>('*'))
      .concat(gallery)
      .find((node) => Array.from(node.classList).some((c) => c.includes('aspect-')));
    expect(aspectNode).toBeTruthy();
  });

  it('reserves the RatingCard footprint (heading + min-h-[7.5rem] inner region) so content does not shift', () => {
    render(<RecordDetailSkeleton />);
    const rating = screen.getByTestId('record-detail-skeleton-rating');
    // Same reserve RatingCard puts on its inner two-column region.
    expect(rating.querySelector('[class*="min-h-[7.5rem]"]')).not.toBeNull();
    // A heading-height placeholder (h-7) matching RatingCard's <h2 class="mb-3 …">.
    expect(rating.querySelector('[class*="h-7"]')).not.toBeNull();
  });

  it('reserves the streaming card height so a late resolve does not shift layout', () => {
    render(<RecordDetailSkeleton />);
    const streaming = screen.getByTestId('record-detail-skeleton-streaming');
    const reserved = Array.from(streaming.querySelectorAll<HTMLElement>('*'))
      .concat(streaming)
      .some((node) => Array.from(node.classList).some((c) => /min-h-/.test(c)));
    expect(reserved).toBe(true);
  });

  it('mirrors the responsive shape: mobile stack, desktop independent-column positioning', () => {
    mockMatchMedia(false);
    const belowLg = render(<RecordDetailSkeleton />);
    const mobileWrapper = belowLg.getByTestId('record-detail-skeleton');
    expect(mobileWrapper.className).toMatch(/flex-col/);
    // The old shared-row CSS Grid mechanism (research.md R1) is gone —
    // independent stacking is now computed by useIndependentColumnLayout,
    // not by a `lg:grid` utility class.
    expect(mobileWrapper.className).not.toMatch(/lg:grid/);
    expect(belowLg.getByTestId('record-detail-skeleton-gallery').parentElement?.style.position).toBe(
      '',
    );
    belowLg.unmount();

    vi.restoreAllMocks();
    mockMatchMedia(true);
    const atLg = render(<RecordDetailSkeleton />);
    expect(
      atLg.getByTestId('record-detail-skeleton-gallery').parentElement?.style.position,
    ).toBe('absolute');
    atLg.unmount();
  });

  it('maps blocks to the same rail/content columns as RecordDetailLayout (gallery/rating/streaming = rail; generalInfo/tracklist/catalog = content)', () => {
    mockMatchMedia(true);
    render(<RecordDetailSkeleton />);

    const railTestIds = [
      'record-detail-skeleton-gallery',
      'record-detail-skeleton-rating',
      'record-detail-skeleton-streaming',
    ];
    const contentTestIds = [
      'record-detail-skeleton-general-info',
      'record-detail-skeleton-tracklist',
      'record-detail-skeleton-catalog',
    ];

    for (const id of railTestIds) {
      expect(screen.getByTestId(id).parentElement?.style.left).toBe('0px');
    }
    for (const id of contentTestIds) {
      // jsdom's style-setter normalizes `calc(20rem + 1.5rem)` to `calc(21.5rem)`.
      expect(screen.getByTestId(id).parentElement?.style.left).toBe('calc(21.5rem)');
    }
  });
});
