import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { DetailColumns } from '../../src/components/DetailColumns';

describe('DetailColumns (feature 064)', () => {
  it('renders left/right content in two independently-stacked columns with no shared full-width row', () => {
    const { container } = render(
      <DetailColumns
        left={<div data-testid="left-content">Left</div>}
        right={<div data-testid="right-content">Right</div>}
      />,
    );

    // Exactly one outer grid element, with the two-column responsive contract
    // and no leftover shared-row (`col-span`) class from the old layout.
    const outer = container.firstElementChild as HTMLElement;
    expect(outer).not.toBeNull();
    expect(outer.className).toContain('grid');
    expect(outer.className).toContain('grid-cols-1');
    expect(outer.className).toContain('items-start');
    expect(outer.className).toContain('gap-4');
    expect(outer.className).toContain('lg:grid-cols-2');
    expect(outer.className).not.toMatch(/col-span/);

    // Exactly two direct children: the left-column and right-column wrappers.
    expect(outer.children).toHaveLength(2);
    const [leftWrapper, rightWrapper] = Array.from(outer.children) as HTMLElement[];

    expect(leftWrapper.className).toContain('flex');
    expect(leftWrapper.className).toContain('flex-col');
    expect(leftWrapper.className).toContain('gap-4');
    expect(leftWrapper.className).not.toMatch(/col-span/);

    expect(rightWrapper.className).toContain('flex');
    expect(rightWrapper.className).toContain('flex-col');
    expect(rightWrapper.className).toContain('gap-4');
    expect(rightWrapper.className).not.toMatch(/col-span/);

    // `left`'s content lives inside the first wrapper, `right`'s inside the second.
    expect(leftWrapper.contains(screen.getByTestId('left-content'))).toBe(true);
    expect(rightWrapper.contains(screen.getByTestId('right-content'))).toBe(true);
  });
});
