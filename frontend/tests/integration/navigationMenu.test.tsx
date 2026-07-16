import { QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import App from '../../src/App';
import { AuthProvider } from '../../src/auth/AuthContext';
import { setSessionToken } from '../../src/services/sessionStore';
import { ThemeProvider } from '../../src/theme/ThemeContext';
import { createTestQueryClient } from '../testUtils';

const originalFetch = global.fetch;

const PROFILE = {
  uid: 'abc123',
  displayName: 'Jane Doe',
  email: 'jane@example.com',
  photoURL: 'https://example.com/photo.png',
};

function renderAuthenticatedApp(initialEntry: string) {
  setSessionToken('existing-session-token');
  global.fetch = vi.fn().mockImplementation((input: string) => {
    if (input.includes('/api/library')) {
      return Promise.resolve({
        ok: true,
        json: async () => ({ items: [], page: 1, pageSize: 20, totalItems: 0 }),
      });
    }
    return Promise.resolve({ ok: true, status: 200, json: async () => PROFILE });
  }) as unknown as typeof fetch;

  return render(
    <ThemeProvider>
      <QueryClientProvider client={createTestQueryClient()}>
        <MemoryRouter initialEntries={[initialEntry]}>
          <AuthProvider>
            <App />
          </AuthProvider>
        </MemoryRouter>
      </QueryClientProvider>
    </ThemeProvider>,
  );
}

describe('Navigation menu (US2)', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    localStorage.clear();
  });

  it('navigates to library, wishlist, and profile from the menu', async () => {
    renderAuthenticatedApp('/app');
    const user = userEvent.setup();

    await waitFor(() => expect(screen.getByText(/check back soon/i)).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: /menu/i }));
    await user.click(
      within(screen.getByRole('dialog')).getByRole('link', { name: /my library/i }),
    );
    await waitFor(() =>
      expect(screen.getByRole('heading', { name: /your library/i })).toBeInTheDocument(),
    );

    await user.click(screen.getByRole('button', { name: /menu/i }));
    await user.click(
      within(screen.getByRole('dialog')).getByRole('link', { name: /my wishlist/i }),
    );
    await waitFor(() =>
      expect(screen.getByRole('heading', { name: /wishlist/i })).toBeInTheDocument(),
    );

    await user.click(screen.getByRole('button', { name: /menu/i }));
    await user.click(
      within(screen.getByRole('dialog')).getByRole('link', { name: /profile/i }),
    );
    await waitFor(() =>
      expect(screen.getByRole('heading', { name: /profile/i })).toBeInTheDocument(),
    );
  });

  it('never shows a menu trigger on the landing page', async () => {
    render(
      <ThemeProvider>
        <QueryClientProvider client={createTestQueryClient()}>
          <MemoryRouter initialEntries={['/']}>
            <AuthProvider>
              <App />
            </AuthProvider>
          </MemoryRouter>
        </QueryClientProvider>
      </ThemeProvider>,
    );

    await waitFor(() =>
      expect(screen.getByRole('button', { name: /sign in with google/i })).toBeEnabled(),
    );
    expect(screen.queryByRole('button', { name: /menu/i })).not.toBeInTheDocument();
  });
});
