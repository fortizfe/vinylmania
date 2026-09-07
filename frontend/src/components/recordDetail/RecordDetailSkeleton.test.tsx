import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { RecordDetailSkeleton } from './RecordDetailSkeleton';

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

  it('reserves the streaming card height so a late resolve does not shift layout', () => {
    render(<RecordDetailSkeleton />);
    const streaming = screen.getByTestId('record-detail-skeleton-streaming');
    const reserved = Array.from(streaming.querySelectorAll<HTMLElement>('*'))
      .concat(streaming)
      .some((node) => Array.from(node.classList).some((c) => /min-h-/.test(c)));
    expect(reserved).toBe(true);
  });

  it('mirrors the responsive shape: mobile stack, desktop rail + column', () => {
    render(<RecordDetailSkeleton />);
    const wrapper = screen.getByTestId('record-detail-skeleton');
    const cls = wrapper.className;
    expect(cls).toMatch(/flex-col/);
    expect(cls).toMatch(/lg:grid/);
  });
});
