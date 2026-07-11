import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { LandingHero } from '../../src/components/LandingHero';

describe('LandingHero', () => {
  it('renders a heading communicating the app purpose', () => {
    render(<LandingHero />);

    const heading = screen.getByRole('heading', { level: 1 });
    expect(heading).toBeInTheDocument();
    expect(heading.textContent).toMatch(/vinyl/i);
  });

  it('renders supporting copy referencing the Discogs-backed catalog, personal ratings, and curated rock/metal news', () => {
    render(<LandingHero />);

    expect(screen.getByText(/discogs/i)).toBeInTheDocument();
    expect(screen.getByText(/rat(e|ing)/i)).toBeInTheDocument();
    expect(screen.getByText(/rock.*metal|metal.*rock/i)).toBeInTheDocument();
    expect(screen.getByText(/news/i)).toBeInTheDocument();
  });

  describe('brand mark (feature 034)', () => {
    it('renders the icon above a grunge-filtered wordmark, stacked, inside the heading', () => {
      render(<LandingHero />);

      const heading = screen.getByRole('heading', { level: 1 });
      const icon = heading.querySelector('svg[aria-hidden="true"]');
      expect(icon).toBeInTheDocument();

      const wordmark = screen.getByText('VINYLMANIA');
      expect(heading).toContainElement(wordmark);
      expect(wordmark.style.filter).toBe('url(#vm-wordmark-grunge)');

      // "general logo" arrangement: icon stacked above the wordmark.
      expect(heading).toHaveClass('flex-col');
    });
  });
});
