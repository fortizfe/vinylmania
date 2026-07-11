import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { LandingHeader } from '../../src/components/LandingHeader';

describe('LandingHeader', () => {
  it('renders the Vinylmania brand and the sign-in action', () => {
    render(<LandingHeader onClick={() => undefined} />);

    expect(screen.getByText(/vinylmania/i)).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /sign in with google/i }),
    ).toBeInTheDocument();
  });

  it('carries sticky-positioning classes so it stays visible while scrolling', () => {
    render(<LandingHeader onClick={() => undefined} />);

    const header = screen.getByRole('banner');
    expect(header.className).toMatch(/sticky/);
    expect(header.className).toMatch(/top-0/);
  });

  it('renders no navigation or anchor links', () => {
    render(<LandingHeader onClick={() => undefined} />);

    expect(screen.queryAllByRole('link')).toHaveLength(0);
  });

  it('passes the loading state through to the sign-in button', () => {
    render(<LandingHeader onClick={() => undefined} loading />);

    expect(screen.getByRole('button', { name: /signing in/i })).toBeInTheDocument();
  });

  it('passes an error message through to the sign-in button', () => {
    render(<LandingHeader onClick={() => undefined} error="Something went wrong" />);

    expect(screen.getByRole('alert')).toHaveTextContent('Something went wrong');
  });

  describe('brand mark (feature 034)', () => {
    it('renders the icon and a clean (non-grunge) wordmark in place of the plain-text label', () => {
      const { container } = render(<LandingHeader onClick={() => undefined} />);

      const icon = container.querySelector('svg[aria-hidden="true"]');
      expect(icon).toBeInTheDocument();

      const wordmark = screen.getByText('VINYLMANIA');
      expect(wordmark).toHaveClass('font-display');
      expect(wordmark.style.filter).toBe('');
    });

    it('lets the brand area shrink rather than force the sign-in button off-screen at narrow widths (FR-008)', () => {
      render(<LandingHeader onClick={() => undefined} />);

      const wordmark = screen.getByText('VINYLMANIA');
      const brandArea = wordmark.closest('div');
      expect(brandArea).toHaveClass('min-w-0');
    });
  });
});
