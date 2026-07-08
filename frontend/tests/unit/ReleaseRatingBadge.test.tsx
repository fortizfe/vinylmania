import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { ReleaseRatingBadge } from '../../src/components/ui/ReleaseRatingBadge';

// WCAG relative-luminance contrast, matching the computation in
// research.md §8 (spec FR-013, ≥4.5:1 required).
function relativeLuminance(hex: string): number {
  const clean = hex.replace('#', '');
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(clean.slice(i, i + 2), 16) / 255);
  const channel = (c: number) =>
    c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  const [rl, gl, bl] = [r, g, b].map(channel);
  return 0.2126 * rl + 0.7152 * gl + 0.0722 * bl;
}

function contrastRatio(hexA: string, hexB: string): number {
  const lA = relativeLuminance(hexA);
  const lB = relativeLuminance(hexB);
  const [lighter, darker] = lA >= lB ? [lA, lB] : [lB, lA];
  return (lighter + 0.05) / (darker + 0.05);
}

// Band tokens from research.md §8 (feature 017) / research.md §2 (feature 019,
// unrated) / data-model.md — kept in sync with the `--color-rating-*` theme
// variables and gray utility classes used in
// src/components/ui/ReleaseRatingBadge.tsx.
const BAND_TOKENS: Record<
  'low' | 'medium' | 'high' | 'unrated',
  { background: string; text: string }
> = {
  low: { background: '#DC2626', text: '#FFFFFF' },
  medium: { background: '#FBBF24', text: '#111827' },
  high: { background: '#15803D', text: '#FFFFFF' },
  unrated: { background: '#D1D5DB', text: '#374151' },
};

// Dark-mode pairing for the unrated band only (feature 019, research.md §2) —
// the low/medium/high bands intentionally keep the same color in both themes.
const UNRATED_DARK_MODE_TOKEN = { background: '#4B5563', text: '#F3F4F6' };

describe('ReleaseRatingBadge', () => {
  it.each(Object.entries(BAND_TOKENS))(
    'meets WCAG AA contrast (>=4.5:1) for the %s band (FR-013/FR-005)',
    (_band, { background, text }) => {
      expect(contrastRatio(background, text)).toBeGreaterThanOrEqual(4.5);
    },
  );

  it('meets WCAG AA contrast (>=4.5:1) for the unrated band in dark mode (spec FR-005)', () => {
    expect(
      contrastRatio(UNRATED_DARK_MODE_TOKEN.background, UNRATED_DARK_MODE_TOKEN.text),
    ).toBeGreaterThanOrEqual(4.5);
  });

  it('uses band background colors that are distinguishable from one another, including the unrated placeholder (SC-001/SC-002)', () => {
    const backgrounds = Object.values(BAND_TOKENS).map((token) => token.background);
    const unique = new Set(backgrounds.map((hex) => hex.toUpperCase()));
    expect(unique.size).toBe(backgrounds.length);
  });

  it('renders the compact one-decimal rating value', () => {
    render(<ReleaseRatingBadge displayValue="4.2" band="high" />);
    expect(screen.getByText('4.2')).toBeInTheDocument();
  });

  it.each([
    ['low', 'bg-rating-low'],
    ['medium', 'bg-rating-medium'],
    ['high', 'bg-rating-high'],
  ] as const)('applies the %s band background class', (band, expectedClass) => {
    render(<ReleaseRatingBadge displayValue="3.0" band={band} />);
    expect(screen.getByText('3.0')).toHaveClass(expectedClass);
  });

  describe('unrated placeholder (feature 019)', () => {
    it('renders a dash instead of a numeric value', () => {
      render(<ReleaseRatingBadge displayValue="-" band="unrated" />);
      expect(screen.getByText('-')).toBeInTheDocument();
    });

    it('applies the soft gray background and dark-mode variant instead of a rating band color', () => {
      render(<ReleaseRatingBadge displayValue="-" band="unrated" />);
      const badge = screen.getByText('-');
      expect(badge).toHaveClass('bg-rating-unrated');
      expect(badge).toHaveClass('dark:bg-gray-600');
    });

    it('exposes a "Rating not available" accessible label instead of the numeric label pattern', () => {
      render(<ReleaseRatingBadge displayValue="-" band="unrated" />);
      expect(
        screen.getByRole('status', { name: 'Rating not available' }),
      ).toBeInTheDocument();
    });
  });

  it.each([
    ['low', '4.2'],
    ['medium', '3.0'],
    ['high', '4.8'],
    ['unrated', '-'],
  ] as const)(
    'keeps identical sizing, rounding, and shadow classes for the %s band (spec FR-004)',
    (band, displayValue) => {
      render(<ReleaseRatingBadge displayValue={displayValue} band={band} />);
      const badge = screen.getByText(displayValue);
      expect(badge).toHaveClass('h-8', 'w-8', 'rounded-md', 'shadow-sm');
    },
  );
});
