import { QueryClientProvider } from '@tanstack/react-query';
import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { AppHeader } from '../../src/components/AppHeader';
import { createTestQueryClient } from '../testUtils';

vi.mock('../../src/auth/AuthContext', () => ({
  useAuth: () => ({ signOut: vi.fn() }),
}));

function renderHeader() {
  // The header search looks suggestions up through TanStack Query (069 US2),
  // so the header needs a client even where no lookup ever runs.
  return render(
    <QueryClientProvider client={createTestQueryClient()}>
      <MemoryRouter>
        <AppHeader />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('AppHeader', () => {
  it('takes its height from the shared --header-h token, so sticky content can sit right below it (spec 067 T050 #2)', () => {
    renderHeader();

    expect(screen.getByRole('banner')).toHaveClass('h-(--header-h)');
  });

  it('renders the hamburger trigger hidden at md+ and the icon nav hidden below md', () => {
    renderHeader();

    const hamburgerTrigger = screen.getByRole('button', { name: /menu/i });
    expect(hamburgerTrigger).toHaveClass('md:hidden');

    const libraryIcon = screen.getByRole('link', { name: /my library/i });
    const iconsContainer = libraryIcon.parentElement;
    expect(iconsContainer).toHaveClass('hidden');
    expect(iconsContainer).toHaveClass('md:flex');
  });

  it('exposes "My wishlist" in the mobile hamburger menu, not only the desktop icon nav (feature 060, FR-001)', async () => {
    const user = userEvent.setup();
    renderHeader();

    await user.click(screen.getByRole('button', { name: /menu/i }));

    const menu = screen.getByRole('dialog');
    expect(within(menu).getByRole('link', { name: /my wishlist/i })).toHaveAttribute(
      'href',
      '/app/wishlist',
    );
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

  describe('scroll-edge treatment (spec 059 US5 — T084)', () => {
    afterEach(() => {
      Object.defineProperty(window, 'scrollY', { value: 0, configurable: true });
      window.dispatchEvent(new Event('scroll'));
    });

    it('has no permanent hard divider and animates the edge on a motion token', () => {
      renderHeader();

      const header = screen.getByRole('banner');
      // The hard 1px bottom border is gone (apple-design §12).
      expect(header.className).not.toMatch(/border-b/);
      expect(header.className).not.toMatch(/border-stone-200/);
      // The edge shadow fades in/out on the shared fade token — no ad-hoc timing.
      expect(header.className).toMatch(/transition-shadow/);
      expect(header.className).toMatch(/duration-\(--motion-duration-fade\)/);
    });

    it('shows the edge shadow only once content has scrolled under it', () => {
      renderHeader();
      const header = screen.getByRole('banner');
      expect(header).not.toHaveClass('header-scroll-edge');

      act(() => {
        Object.defineProperty(window, 'scrollY', { value: 120, configurable: true });
        window.dispatchEvent(new Event('scroll'));
      });
      expect(header).toHaveClass('header-scroll-edge');

      act(() => {
        Object.defineProperty(window, 'scrollY', { value: 0, configurable: true });
        window.dispatchEvent(new Event('scroll'));
      });
      expect(header).not.toHaveClass('header-scroll-edge');
    });
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

  describe('header search expansion (069 US1 — FR-006, SC-008)', () => {
    /** The backdrop, or null while the search is collapsed. */
    function scrim(): HTMLElement | null {
      return document.querySelector<HTMLElement>('div.overlay-scrim');
    }

    /** The control that opens the search — the "Search" button carrying `aria-expanded`. */
    function opener(expanded: boolean): HTMLElement {
      return screen.getByRole('button', { name: /search/i, expanded });
    }

    it('grows the middle cell for the expanded form without moving the side cells or changing the header height', async () => {
      const user = userEvent.setup();
      renderHeader();

      const header = screen.getByRole('banner');
      await user.click(opener(false));

      // The three-cell grid and the shared height token survive the expansion:
      // nothing below the header can move (SC-008).
      expect(header).toHaveClass('h-(--header-h)');
      expect(header.className).toMatch(/grid-cols-\[1fr_auto_1fr\]/);

      // Left cell, then the expanded search, then the right cell — the side
      // cells keep their rendered order.
      const brand = screen.getByRole('link', { name: 'Vinylmania' });
      const search = screen.getByRole('search');
      const signOut = screen.getByRole('button', { name: /sign out/i });
      expect(
        brand.compareDocumentPosition(search) & Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
      expect(
        search.compareDocumentPosition(signOut) & Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
    });

    it('mounts the backdrop below the header — z-30 against the header’s z-40', async () => {
      const user = userEvent.setup();
      renderHeader();

      await user.click(opener(false));

      expect(screen.getByRole('banner')).toHaveClass('z-40');
      expect(scrim()).toHaveClass('fixed', 'inset-0', 'z-30');
    });

    it('leaves the header markup as it is today while the search is collapsed', () => {
      renderHeader();

      expect(scrim()).toBeNull();
      expect(opener(false)).toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'Vinylmania' })).toBeInTheDocument();
      expect(screen.getByRole('search')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /sign out/i })).toBeInTheDocument();
      expect(screen.getByRole('banner')).toHaveClass('h-(--header-h)');
    });
  });
});
