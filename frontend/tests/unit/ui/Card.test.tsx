import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Card } from '../../../src/components/ui/Card';

describe('Card', () => {
  it('renders its children inside a rounded, bordered, soft-shadow surface with default padding', () => {
    render(<Card>Card content</Card>);

    const card = screen.getByText('Card content');
    expect(card.className).toMatch(/rounded-xl/);
    expect(card.className).toMatch(/border/);
    expect(card.className).toMatch(/shadow-sm/);
    expect(card.className).toMatch(/p-6/);
  });

  it('never uses a strong shadow on a standard surface (FR-012)', () => {
    render(<Card>Restrained shadow</Card>);

    const card = screen.getByText('Restrained shadow');
    expect(card.className).not.toMatch(/shadow-(md|lg|xl|2xl)/);
  });

  it('uses smaller padding when padding="sm"', () => {
    render(<Card padding="sm">Small card</Card>);

    expect(screen.getByText('Small card').className).toMatch(/p-4/);
  });

  it('merges a caller-supplied className without dropping the base classes', () => {
    render(<Card className="custom-class">Custom card</Card>);

    const card = screen.getByText('Custom card');
    expect(card.className).toMatch(/custom-class/);
    expect(card.className).toMatch(/rounded-xl/);
  });
});
