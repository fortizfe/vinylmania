import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { LandingPillarSection } from '../../../src/components/LandingPillarSection';
import { UnderConstruction } from '../../../src/components/UnderConstruction';

/**
 * Spec 059 FR-015 / US5 — display/large text (page, pillar and showcase
 * headings set in `--font-display` / Anton) carries the deliberate
 * `--tracking-display` (-0.02em) + `--leading-display` (1.05) tokens, exposed
 * as the `tracking-display` / `leading-display` utilities. The fixed
 * `text-*` size + an explicit `leading-*` pairing is kept so an Anton
 * font-swap never reflows the line box (constitution "No layout shift").
 */
describe('display-heading typography (FR-015 / US5)', () => {
  it('LandingPillarSection heading pairs font-display with the tracking + leading tokens', () => {
    render(
      <LandingPillarSection
        icon={<svg data-testid="icon" />}
        title="Your catalog, powered by Discogs"
        description="Every release backed by Discogs metadata."
      />,
    );

    const heading = screen.getByRole('heading', { name: /your catalog/i });
    expect(heading).toHaveClass('font-display');
    expect(heading).toHaveClass('tracking-display');
    expect(heading).toHaveClass('leading-display');
    // Fixed size stays for the no-layout-shift pairing.
    expect(heading.className).toMatch(/\btext-(xs|sm|base|lg|xl|\dxl)\b/);
  });

  it('UnderConstruction heading pairs font-display with the tracking + leading tokens', () => {
    render(<UnderConstruction title="Dashboard" />);

    const heading = screen.getByRole('heading', { name: 'Dashboard' });
    expect(heading).toHaveClass('font-display');
    expect(heading).toHaveClass('tracking-display');
    expect(heading).toHaveClass('leading-display');
    expect(heading.className).toMatch(/\btext-(xs|sm|base|lg|xl|\dxl)\b/);
  });

  it('does not stack a second leading-* utility alongside leading-display', () => {
    render(<UnderConstruction title="Dashboard" />);

    const heading = screen.getByRole('heading', { name: 'Dashboard' });
    expect(heading.className).not.toMatch(
      /leading-tight|leading-none|leading-snug|leading-normal/,
    );
  });
});
