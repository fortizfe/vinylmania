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
});
