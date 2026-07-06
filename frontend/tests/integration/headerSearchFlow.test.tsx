import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import { AppHeader } from '../../src/components/AppHeader';

vi.mock('../../src/auth/AuthContext', () => ({
  useAuth: () => ({ signOut: vi.fn() }),
}));

function renderHeader(initialEntries: string[] = ['/app']) {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <AppHeader />
    </MemoryRouter>,
  );
}

describe('Header search (US1)', () => {
  it('shows the search box alongside the brand link and the existing header controls', () => {
    renderHeader();

    expect(screen.getByRole('link', { name: /vinylmania/i })).toBeInTheDocument();
    expect(screen.getByRole('searchbox', { name: /search discogs/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /menu/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sign out/i })).toBeInTheDocument();
  });

  it('renders the same search box regardless of which authenticated page the header is mounted on', () => {
    renderHeader(['/app/library']);

    expect(screen.getByRole('searchbox', { name: /search discogs/i })).toBeInTheDocument();
  });
});
