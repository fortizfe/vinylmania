import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import App from '../../src/App';
import { AuthProvider } from '../../src/auth/AuthContext';

const mockOnAuthStateChanged = vi.fn();

vi.mock('firebase/auth', () => ({
  signInWithPopup: vi.fn(),
  signOut: vi.fn(),
  onAuthStateChanged: (...args: unknown[]) => mockOnAuthStateChanged(...args),
}));

vi.mock('../../src/services/firebaseClient', () => ({
  firebaseAuth: {},
  googleAuthProvider: {},
}));

const originalFetch = global.fetch;

function renderAuthenticatedApp(initialEntry: string) {
  mockOnAuthStateChanged.mockImplementation((_auth, callback) => {
    callback({ getIdToken: async () => 'fake-id-token' });
    return () => undefined;
  });
  global.fetch = vi.fn().mockImplementation((input: string) => {
    if (input.includes('/api/library')) {
      return Promise.resolve({
        ok: true,
        json: async () => ({ items: [], page: 1, pageSize: 20, totalItems: 0 }),
      });
    }
    return Promise.resolve({
      ok: true,
      json: async () => ({
        uid: 'abc123',
        displayName: 'Jane Doe',
        email: 'jane@example.com',
        photoURL: 'https://example.com/photo.png',
      }),
    });
  }) as unknown as typeof fetch;

  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <AuthProvider>
        <App />
      </AuthProvider>
    </MemoryRouter>,
  );
}

describe('Navigation menu (US2)', () => {
  beforeEach(() => {
    mockOnAuthStateChanged.mockReset();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('navigates to library, wishlist, and profile from the menu', async () => {
    renderAuthenticatedApp('/app');
    const user = userEvent.setup();

    await waitFor(() =>
      expect(screen.getByRole('heading', { name: /dashboard/i })).toBeInTheDocument(),
    );

    await user.click(screen.getByRole('button', { name: /menu/i }));
    await user.click(screen.getByRole('link', { name: /my library/i }));
    await waitFor(() =>
      expect(screen.getByRole('heading', { name: /your library/i })).toBeInTheDocument(),
    );

    await user.click(screen.getByRole('button', { name: /menu/i }));
    await user.click(screen.getByRole('link', { name: /my wishlist/i }));
    await waitFor(() =>
      expect(screen.getByRole('heading', { name: /wishlist/i })).toBeInTheDocument(),
    );

    await user.click(screen.getByRole('button', { name: /menu/i }));
    await user.click(screen.getByRole('link', { name: /profile/i }));
    await waitFor(() =>
      expect(screen.getByRole('heading', { name: /profile/i })).toBeInTheDocument(),
    );
  });

  it('never shows a menu trigger on the landing page', async () => {
    mockOnAuthStateChanged.mockImplementation((_auth, callback) => {
      callback(null);
      return () => undefined;
    });

    render(
      <MemoryRouter initialEntries={['/']}>
        <AuthProvider>
          <App />
        </AuthProvider>
      </MemoryRouter>,
    );

    await waitFor(() =>
      expect(screen.getByRole('button', { name: /sign in with google/i })).toBeEnabled(),
    );
    expect(screen.queryByRole('button', { name: /menu/i })).not.toBeInTheDocument();
  });
});
