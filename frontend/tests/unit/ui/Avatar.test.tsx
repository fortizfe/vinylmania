import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Avatar } from '../../../src/components/ui/Avatar';

describe('Avatar', () => {
  it('renders an image at the default (md) size when src is present', () => {
    render(<Avatar src="https://example.com/cover.jpg" alt="Album cover" />);

    const img = screen.getByRole('img', { name: 'Album cover' });
    expect(img.className).toMatch(/w-12/);
    expect(img.className).toMatch(/h-12/);
  });

  it('renders a same-sized placeholder when src is absent', () => {
    const { container: withSrc } = render(
      <Avatar src="https://example.com/cover.jpg" alt="a" size="lg" />,
    );
    const { container: withoutSrc } = render(<Avatar alt="a" size="lg" />);

    const sizedEl = (c: HTMLElement) => c.querySelector('[class*="w-"]') as HTMLElement;
    const extractSize = (el: HTMLElement) =>
      el.className
        .split(' ')
        .filter((cls) => /^(w-|h-)/.test(cls))
        .sort();

    expect(extractSize(sizedEl(withoutSrc))).toEqual(extractSize(sizedEl(withSrc)));
  });
});
