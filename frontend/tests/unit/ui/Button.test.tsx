import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Button } from '../../../src/components/ui/Button';

describe('Button', () => {
  it('renders the primary variant by default', () => {
    render(<Button>Primary action</Button>);

    const button = screen.getByRole('button', { name: 'Primary action' });
    expect(button.className).toMatch(/bg-primary/);
  });

  it('renders the secondary variant with a bordered, neutral treatment', () => {
    render(<Button variant="secondary">Secondary action</Button>);

    const button = screen.getByRole('button', { name: 'Secondary action' });
    expect(button.className).not.toMatch(/bg-primary/);
    expect(button.className).toMatch(/border/);
  });

  it('disables the button and sets aria-busy when loading, without changing its footprint', () => {
    render(
      <>
        <Button>Idle</Button>
        <Button loading>Idle</Button>
      </>,
    );

    const [idle, loading] = screen.getAllByRole('button', { name: 'Idle' });
    expect(loading).toBeDisabled();
    expect(loading).toHaveAttribute('aria-busy', 'true');

    const sizeClasses = (el: HTMLElement) =>
      el.className
        .split(' ')
        .filter((cls) => /^(px-|py-|p-)/.test(cls))
        .sort();
    expect(sizeClasses(loading)).toEqual(sizeClasses(idle));
  });

  it('uses medium/semibold weight rather than heavy bold text (FR-011)', () => {
    render(<Button>Weighted</Button>);

    const button = screen.getByRole('button', { name: 'Weighted' });
    expect(button.className).toMatch(/font-medium/);
    expect(button.className).not.toMatch(/font-bold/);
  });
});
