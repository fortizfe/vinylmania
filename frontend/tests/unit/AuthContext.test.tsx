import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AuthProvider, useAuth } from '../../src/auth/AuthContext';

const mockSignInWithPopup = vi.fn();
const mockSignOut = vi.fn();
const mockOnAuthStateChanged = vi.fn();

vi.mock('firebase/auth', () => ({
  signInWithPopup: (...args: unknown[]) => mockSignInWithPopup(...args),
  signOut: (...args: unknown[]) => mockSignOut(...args),
  onAuthStateChanged: (...args: unknown[]) => mockOnAuthStateChanged(...args),
}));

vi.mock('../../src/services/firebaseClient', () => ({
  firebaseAuth: {},
  googleAuthProvider: {},
}));

const originalFetch = global.fetch;

function TestConsumer() {
  const { user, loading, error, signIn, signOut } = useAuth();

  if (loading) return <p>loading</p>;

  return (
    <div>
      <p data-testid="user">{user ? user.displayName : 'anonymous'}</p>
      {error && <p role="alert">{error}</p>}
      <button onClick={signIn}>sign-in</button>
      <button onClick={signOut}>sign-out</button>
    </div>
  );
}

describe('AuthContext', () => {
  beforeEach(() => {
    mockSignInWithPopup.mockReset();
    mockSignOut.mockReset();
    mockOnAuthStateChanged.mockReset().mockImplementation((_auth, callback) => {
      callback(null);
      return () => undefined;
    });
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        uid: 'abc123',
        displayName: 'Jane Doe',
        email: 'jane@example.com',
        photoURL: 'https://example.com/photo.png',
      }),
    }) as unknown as typeof fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('starts signed out', async () => {
    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>,
    );

    await waitFor(() => expect(screen.getByTestId('user')).toHaveTextContent('anonymous'));
  });

  it('signs the user in via Google popup and calls the session endpoint', async () => {
    mockSignInWithPopup.mockResolvedValue({
      user: {
        uid: 'abc123',
        displayName: 'Jane Doe',
        email: 'jane@example.com',
        photoURL: 'https://example.com/photo.png',
        getIdToken: async () => 'fake-id-token',
      },
    });

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>,
    );

    const user = userEvent.setup();
    await act(async () => {
      await user.click(screen.getByText('sign-in'));
    });

    await waitFor(() => expect(screen.getByTestId('user')).toHaveTextContent('Jane Doe'));
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/auth/session'),
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ Authorization: 'Bearer fake-id-token' }),
      }),
    );
  });

  it('surfaces a friendly error when the popup is cancelled', async () => {
    mockSignInWithPopup.mockRejectedValue({ code: 'auth/popup-closed-by-user' });

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>,
    );

    const user = userEvent.setup();
    await act(async () => {
      await user.click(screen.getByText('sign-in'));
    });

    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
    expect(screen.getByTestId('user')).toHaveTextContent('anonymous');
  });

  it('clears the signed-in user when signOut is called', async () => {
    mockSignInWithPopup.mockResolvedValue({
      user: {
        uid: 'abc123',
        displayName: 'Jane Doe',
        email: 'jane@example.com',
        photoURL: 'https://example.com/photo.png',
        getIdToken: async () => 'fake-id-token',
      },
    });
    mockSignOut.mockResolvedValue(undefined);

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>,
    );

    const user = userEvent.setup();
    await act(async () => {
      await user.click(screen.getByText('sign-in'));
    });
    await waitFor(() => expect(screen.getByTestId('user')).toHaveTextContent('Jane Doe'));

    await act(async () => {
      await user.click(screen.getByText('sign-out'));
    });

    expect(mockSignOut).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(screen.getByTestId('user')).toHaveTextContent('anonymous'));
  });
});
