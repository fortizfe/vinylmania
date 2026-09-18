import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { MasterReleaseDetailSkeleton } from '../../src/components/MasterReleaseDetailSkeleton';

/**
 * Spec 065 (US2): the top `aspect-square` gallery placeholder and the nested
 * info-stack grid used to share a CSS Grid row (`grid-cols-1 lg:grid-cols-2`),
 * which reserved a gap-sized empty space under whichever placeholder was
 * shorter. They must instead render inside their own Flexbox row wrapper, the
 * same fix applied to the real page (MasterReleaseDetailPage.tsx). This does
 * NOT rebuild the skeleton to mirror the real page's card structure — see the
 * component's own doc comment — it only fixes the internal shared-row gap.
 */
describe('MasterReleaseDetailSkeleton', () => {
  it('keeps the record-detail-skeleton test id', () => {
    render(<MasterReleaseDetailSkeleton />);
    expect(screen.getByTestId('record-detail-skeleton')).toBeInTheDocument();
  });

  it('renders the top gallery placeholder and info-stack grid inside a flex row wrapper', () => {
    render(<MasterReleaseDetailSkeleton />);
    const skeleton = screen.getByTestId('record-detail-skeleton');

    const gallery = skeleton.querySelector<HTMLElement>('.aspect-square');
    expect(gallery).not.toBeNull();

    const rowWrapper = gallery?.parentElement;
    expect(rowWrapper).not.toBeNull();
    expect(rowWrapper?.className).toMatch(/\bflex\b/);
    // Side-by-side starts at `xl`, matching the original breakpoint where the
    // gallery/info-stack pair was ever placed together in a shared row — `lg`
    // keeps its pre-existing single stacked column, unchanged by this fix.
    expect(rowWrapper?.className).toMatch(/xl:flex-row/);
    expect(rowWrapper?.className).not.toMatch(/lg:flex-row/);
    expect(rowWrapper?.className).not.toMatch(/grid-cols-2/);

    // The nested info-stack grid is the gallery placeholder's next sibling
    // inside that same row wrapper (no shared grid row, no DOM reordering).
    const infoStack = rowWrapper?.children[1];
    expect(infoStack).toBeDefined();
    expect(infoStack?.className).toMatch(/grid/);
    expect(gallery?.parentElement).toBe(rowWrapper);
  });

  it('leaves the trailing full-width skeleton bar unaffected', () => {
    render(<MasterReleaseDetailSkeleton />);
    const skeleton = screen.getByTestId('record-detail-skeleton');
    const bar = skeleton.querySelector<HTMLElement>('.h-16.w-full');
    expect(bar).not.toBeNull();
    expect(bar?.className).toMatch(/lg:col-span-2/);
    expect(bar?.className).toMatch(/xl:col-span-3/);
  });
});
