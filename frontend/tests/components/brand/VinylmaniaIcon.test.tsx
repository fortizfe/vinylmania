import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { VinylmaniaIcon } from '../../../src/components/brand/VinylmaniaIcon';

describe('VinylmaniaIcon', () => {
  it('renders at the given size', () => {
    const { container } = render(<VinylmaniaIcon size={36} />);
    const svg = container.querySelector('svg');

    expect(svg).toHaveAttribute('width', '36');
    expect(svg).toHaveAttribute('height', '36');
  });

  it('applies dark-variant fill classes on the outer and center circles', () => {
    const { container } = render(<VinylmaniaIcon size={36} />);
    const circles = container.querySelectorAll('circle');

    const outer = Array.from(circles).find((c) =>
      c.getAttribute('class')?.includes('fill-landing-surface'),
    );
    const center = Array.from(circles).find((c) =>
      c.getAttribute('class')?.includes('fill-landing-accent'),
    );

    expect(outer).toBeDefined();
    expect(outer?.getAttribute('class')).toContain('dark:fill-brand-icon-dark-bg');
    expect(center).toBeDefined();
    expect(center?.getAttribute('class')).toContain('dark:fill-primary');
  });

  it('is aria-hidden and non-focusable (purely decorative)', () => {
    const { container } = render(<VinylmaniaIcon size={36} />);
    const svg = container.querySelector('svg');

    expect(svg).toHaveAttribute('aria-hidden', 'true');
    expect(svg).toHaveAttribute('focusable', 'false');
  });

  it('accepts a passthrough className for responsive sizing overrides', () => {
    const { container } = render(
      <VinylmaniaIcon size={28} className="md:h-9 md:w-9" />,
    );
    const svg = container.querySelector('svg');

    expect(svg).toHaveClass('md:h-9');
    expect(svg).toHaveClass('md:w-9');
  });
});
