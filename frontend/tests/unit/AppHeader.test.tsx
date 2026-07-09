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
    expect(header).toHaveClass('dark:bg-gray-950');
  });
});
