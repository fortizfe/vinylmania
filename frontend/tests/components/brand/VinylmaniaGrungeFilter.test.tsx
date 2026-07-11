import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { VinylmaniaGrungeFilter } from '../../../src/components/brand/VinylmaniaGrungeFilter';

describe('VinylmaniaGrungeFilter', () => {
  it('renders exactly one visually-hidden filter definition with the expected id', () => {
    const { container } = render(<VinylmaniaGrungeFilter />);

    const filters = container.querySelectorAll('filter#vm-wordmark-grunge');
    expect(filters).toHaveLength(1);

    const svg = container.querySelector('svg');
    expect(svg).toHaveAttribute('aria-hidden', 'true');
    expect(svg).toHaveClass('absolute');
    expect(svg).toHaveClass('h-0');
    expect(svg).toHaveClass('w-0');
  });
});
