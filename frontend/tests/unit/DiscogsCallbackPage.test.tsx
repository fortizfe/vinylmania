import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { DiscogsCallbackPage } from '../../src/pages/DiscogsCallbackPage';

const mocks = vi.hoisted(() => ({
  useCompleteDiscogsLink: vi.fn(),
}));

vi.mock('../../src/queries/discogsOauthQueries', () => mocks);

function ProfileProbe() {
  const location = useLocation();
  const outcome = (location.state as { discogsOutcome?: string } | null)?.discogsOutcome;
  return <div data-testid="profile-probe">{outcome ?? 'none'}</div>;
}

function renderCallback(search: string) {
  return render(
    <MemoryRouter initialEntries={[`/app/profile/discogs/callback${search}`]}>
      <Routes>
        <Route path="/app/profile/discogs/callback" element={<DiscogsCallbackPage />} />
        <Route path="/app/profile" element={<ProfileProbe />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('DiscogsCallbackPage', () => {
  it('completes the link with the query params and navigates to the profile with a linked outcome', async () => {
    const mutateAsync = vi.fn().mockResolvedValue({ connected: true });
    mocks.useCompleteDiscogsLink.mockReturnValue({ mutateAsync, isPending: true });

    renderCallback('?oauth_token=req-tok&oauth_verifier=the-verifier');

    await waitFor(() => {
      expect(mutateAsync).toHaveBeenCalledWith({
        oauthToken: 'req-tok',
        oauthVerifier: 'the-verifier',
      });
    });

    await waitFor(() => {
      expect(screen.getByTestId('profile-probe')).toHaveTextContent('linked');
    });
  });

  it('shows a skeleton while the completion is in flight', () => {
    mocks.useCompleteDiscogsLink.mockReturnValue({
      mutateAsync: vi.fn(() => new Promise(() => {})),
      isPending: true,
    });

    renderCallback('?oauth_token=req-tok&oauth_verifier=the-verifier');

    expect(screen.getByTestId('discogs-callback-skeleton')).toBeInTheDocument();
  });

  describe('failure handling (US3)', () => {
    it('navigates with a denied outcome and no API call when Discogs sends the denied param', async () => {
      const mutateAsync = vi.fn();
      mocks.useCompleteDiscogsLink.mockReturnValue({ mutateAsync, isPending: false });

      renderCallback('?denied=req-tok');

      await waitFor(() => {
        expect(screen.getByTestId('profile-probe')).toHaveTextContent('denied');
      });
      expect(mutateAsync).not.toHaveBeenCalled();
    });

    it('navigates with a denied outcome when the verifier is missing', async () => {
      const mutateAsync = vi.fn();
      mocks.useCompleteDiscogsLink.mockReturnValue({ mutateAsync, isPending: false });

      renderCallback('?oauth_token=req-tok');

      await waitFor(() => {
        expect(screen.getByTestId('profile-probe')).toHaveTextContent('denied');
      });
      expect(mutateAsync).not.toHaveBeenCalled();
    });

    it('maps an expired_request API error to the expired outcome', async () => {
      const mutateAsync = vi.fn().mockRejectedValue({ code: 'expired_request' });
      mocks.useCompleteDiscogsLink.mockReturnValue({ mutateAsync, isPending: false });

      renderCallback('?oauth_token=req-tok&oauth_verifier=v');

      await waitFor(() => {
        expect(screen.getByTestId('profile-probe')).toHaveTextContent('expired');
      });
    });

    it('maps any other API error to the error outcome', async () => {
      const mutateAsync = vi.fn().mockRejectedValue(new Error('network down'));
      mocks.useCompleteDiscogsLink.mockReturnValue({ mutateAsync, isPending: false });

      renderCallback('?oauth_token=req-tok&oauth_verifier=v');

      await waitFor(() => {
        expect(screen.getByTestId('profile-probe')).toHaveTextContent('error');
      });
    });
  });
});
