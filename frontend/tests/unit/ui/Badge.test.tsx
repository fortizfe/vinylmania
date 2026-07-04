import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Badge } from '../../../src/components/ui/Badge';

describe('Badge', () => {
  it('renders neutral tone by default', () => {
    render(<Badge>Mint</Badge>);

    expect(screen.getByText('Mint').className).toMatch(/bg-gray-100/);
  });

  it('renders a visually distinct muted tone', () => {
    render(<Badge tone="muted">Draft</Badge>);

    const neutralClasses = 'bg-gray-100';
    expect(screen.getByText('Draft').className).not.toContain(neutralClasses);
  });
});
