import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { LoginCallbackPage } from '../../src/pages/LoginCallbackPage';

const mocks = vi.hoisted(() => ({
  useAuth: vi.fn(),
}));

vi.mock('../../src/auth/AuthContext', () => ({ useAuth: mocks.useAuth }));

function LandingProbe() {
  const location = useLocation();
  return <div data-testid="landing-probe">{location.pathname}</div>;
}

function AppProbe() {
  const location = useLocation();
  return <div data-testid="app-probe">{location.pathname}</div>;
}

function renderCallback(search: string) {
  return render(
    <MemoryRouter initialEntries={[`/login/callback${search}`]}>
      <Routes>
        <Route path="/login/callback" element={<LoginCallbackPage />} />
        <Route path="/" element={<LandingProbe />} />
        <Route path="/app" element={<AppProbe />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('LoginCallbackPage', () => {
  it('shows a skeleton while the completion is in flight', () => {
    mocks.useAuth.mockReturnValue({
      completeSignIn: vi.fn(() => new Promise(() => {})),
    });

    renderCallback('?code=auth-code&state=abc');

    expect(screen.getByTestId('login-callback-skeleton')).toBeInTheDocument();
  });

  it('completes sign-in with the query params and navigates to /app on success', async () => {
    const completeSignIn = vi.fn().mockResolvedValue('success');
    mocks.useAuth.mockReturnValue({ completeSignIn });

    renderCallback('?code=auth-code&state=abc');

    await waitFor(() => {
      expect(completeSignIn).toHaveBeenCalledWith({ state: 'abc', code: 'auth-code', error: undefined });
    });
    await waitFor(() => {
      expect(screen.getByTestId('app-probe')).toBeInTheDocument();
    });
  });

  it('calls completeSignIn with the denial signal and navigates back to landing when Google reports access_denied', async () => {
    const completeSignIn = vi.fn().mockResolvedValue('denied');
    mocks.useAuth.mockReturnValue({ completeSignIn });

    renderCallback('?error=access_denied&state=abc');

    await waitFor(() => {
      expect(completeSignIn).toHaveBeenCalledWith({ state: 'abc', code: undefined, error: 'access_denied' });
    });
    await waitFor(() => {
      expect(screen.getByTestId('landing-probe')).toBeInTheDocument();
    });
  });

  it('navigates back to landing on an expired or generic error outcome', async () => {
    const completeSignIn = vi.fn().mockResolvedValue('expired');
    mocks.useAuth.mockReturnValue({ completeSignIn });

    renderCallback('?code=auth-code&state=stale-state');

    await waitFor(() => {
      expect(screen.getByTestId('landing-probe')).toBeInTheDocument();
    });
  });

  it('calls completeSignIn exactly once even under React StrictMode-style double effects', async () => {
    const completeSignIn = vi.fn().mockResolvedValue('success');
    mocks.useAuth.mockReturnValue({ completeSignIn });

    renderCallback('?code=auth-code&state=abc');

    await waitFor(() => expect(screen.getByTestId('app-probe')).toBeInTheDocument());
    expect(completeSignIn).toHaveBeenCalledTimes(1);
  });
});
