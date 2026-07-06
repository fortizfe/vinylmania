import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { ReleaseRatingBadge } from '../../src/components/ui/ReleaseRatingBadge';

// WCAG relative-luminance contrast, matching the computation in
// research.md §8 (spec FR-013, ≥4.5:1 required).
function relativeLuminance(hex: string): number {
  const clean = hex.replace('#', '');
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(clean.slice(i, i + 2), 16) / 255);
  const channel = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  const [rl, gl, bl] = [r, g, b].map(channel);
  return 0.2126 * rl + 0.7152 * gl + 0.0722 * bl;
}

function contrastRatio(hexA: string, hexB: string): number {
  const lA = relativeLuminance(hexA);
  const lB = relativeLuminance(hexB);
  const [lighter, darker] = lA >= lB ? [lA, lB] : [lB, lA];
  return (lighter + 0.05) / (darker + 0.05);
}

// Band tokens from research.md §8 / data-model.md — kept in sync with the
// `--color-rating-*` theme variables defined in src/styles/global.css.
const BAND_TOKENS: Record<'low' | 'medium' | 'high', { background: string; text: string }> = {
  low: { background: '#DC2626', text: '#FFFFFF' },
  medium: { background: '#FBBF24', text: '#111827' },
  high: { background: '#15803D', text: '#FFFFFF' },
};

describe('ReleaseRatingBadge', () => {
  it.each(Object.entries(BAND_TOKENS))(
    'meets WCAG AA contrast (>=4.5:1) for the %s band (FR-013)',
    (_band, { background, text }) => {
      expect(contrastRatio(background, text)).toBeGreaterThanOrEqual(4.5);
    },
  );

  it('uses band background colors that are distinguishable from one another (SC-001)', () => {
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
});
