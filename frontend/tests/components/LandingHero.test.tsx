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

  it('renders a short supporting statement of what the app does', () => {
    render(<LandingHero />);

    expect(
      screen.getByText(/organi[sz]e|manage|collection/i),
    ).toBeInTheDocument();
  });
});
