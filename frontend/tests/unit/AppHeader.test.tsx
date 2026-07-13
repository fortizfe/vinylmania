import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import { AppHeader } from '../../src/components/AppHeader';

vi.mock('../../src/auth/AuthContext', () => ({
  useAuth: () => ({ signOut: vi.fn() }),
}));

function renderHeader() {
  return render(
    <MemoryRouter>
      <AppHeader />
    </MemoryRouter>,
  );
}

describe('AppHeader', () => {
  it('renders the hamburger trigger hidden at md+ and the icon nav hidden below md', () => {
    renderHeader();

    const hamburgerTrigger = screen.getByRole('button', { name: /menu/i });
    expect(hamburgerTrigger).toHaveClass('md:hidden');

    const libraryIcon = screen.getByRole('link', { name: /my library/i });
    const iconsContainer = libraryIcon.parentElement;
    expect(iconsContainer).toHaveClass('hidden');
    expect(iconsContainer).toHaveClass('md:flex');
  });

  it('keeps the "Sign out" button present and unchanged alongside both nav presentations (FR-010)', () => {
    renderHeader();

    expect(screen.getByRole('button', { name: /sign out/i })).toBeInTheDocument();
  });

  it('stays fixed at the top of the viewport while scrolling (FR-001, FR-002, FR-003)', () => {
    renderHeader();

    const header = screen.getByRole('banner');
    expect(header).toHaveClass('sticky');
    expect(header).toHaveClass('top-0');
    expect(header).toHaveClass('bg-white');
    expect(header).toHaveClass('dark:bg-surface-raised');
  });

  describe('brand mark (feature 034)', () => {
    it('carries an accessible name, a 44x44 touch target, and still navigates to /app (FR-001, FR-005, FR-006)', () => {
      renderHeader();

      const brandLink = screen.getByRole('link', { name: 'Vinylmania' });
      expect(brandLink).toHaveAttribute('href', '/app');
      expect(brandLink).toHaveClass('min-h-11');
      expect(brandLink).toHaveClass('min-w-11');
    });

    it('always renders the icon, sized 28px below md: and 36px at md:+ (FR-001, FR-011)', () => {
      renderHeader();

      const brandLink = screen.getByRole('link', { name: 'Vinylmania' });
      const icon = brandLink.querySelector('svg[aria-hidden="true"]');
      expect(icon).toBeInTheDocument();
      expect(icon).toHaveClass('h-7');
      expect(icon).toHaveClass('w-7');
      expect(icon).toHaveClass('md:h-9');
      expect(icon).toHaveClass('md:w-9');
    });

    it('hides the wordmark below md: and shows it at md:+, at a fixed (non-scaling) size (FR-001, FR-011, FR-012)', () => {
      renderHeader();

      const wordmark = screen.getByText('VINYLMANIA');
      expect(wordmark).toHaveClass('hidden');
      expect(wordmark).toHaveClass('md:inline-block');
      // Clean (non-grunge) typography at header size.
      expect(wordmark.style.filter).toBe('');
    });

    it("keeps a fixed min-height regardless of the wordmark's font, so a font swap can't reflow the header (FR-010)", () => {
      renderHeader();

      // min-h-11 (44px, fixed) already dominates over any font-metric
      // variance from the wordmark's Anton font loading — the same class
      // that satisfies the touch-target rule also prevents layout shift.
      const brandLink = screen.getByRole('link', { name: 'Vinylmania' });
      expect(brandLink).toHaveClass('min-h-11');
    });
  });
});
