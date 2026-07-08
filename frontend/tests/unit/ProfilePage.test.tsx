import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ProfilePage } from '../../src/pages/ProfilePage';

const mocks = vi.hoisted(() => ({
  useDiscogsStatus: vi.fn(),
  useRequestDiscogsLink: vi.fn(),
  useDisconnectDiscogs: vi.fn(),
}));

vi.mock('../../src/queries/discogsOauthQueries', () => mocks);

function renderProfile(state?: { discogsOutcome?: string }) {
  return render(
    <MemoryRouter initialEntries={[{ pathname: '/app/profile', state }]}>
      <ProfilePage />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.useDiscogsStatus.mockReturnValue({
    data: { connected: false },
    isPending: false,
    isError: false,
  });
  mocks.useRequestDiscogsLink.mockReturnValue({ mutate: vi.fn(), isPending: false });
  mocks.useDisconnectDiscogs.mockReturnValue({ mutate: vi.fn(), isPending: false });
});

describe('ProfilePage', () => {
  it('hosts the Discogs connection card', () => {
    renderProfile();

    expect(screen.getByRole('heading', { name: 'Discogs' })).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /connect discogs account/i }),
    ).toBeInTheDocument();
  });

  it('shows a dismissible success message when arriving with a linked outcome', async () => {
    const user = userEvent.setup();
    renderProfile({ discogsOutcome: 'linked' });

    const message = screen.getByText(/discogs account linked/i);
    expect(message).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /dismiss/i }));
    expect(screen.queryByText(/discogs account linked/i)).not.toBeInTheDocument();
  });

  it('shows no outcome message on a plain visit', () => {
    renderProfile();

    expect(screen.queryByText(/discogs account linked/i)).not.toBeInTheDocument();
  });

  describe('failure outcomes (US3)', () => {
    it('shows a distinct message for a denied connection with the card still usable', () => {
      renderProfile({ discogsOutcome: 'denied' });

      expect(screen.getByText(/was not completed/i)).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: /connect discogs account/i }),
      ).toBeInTheDocument();
    });

    it('shows a distinct message for an expired attempt', () => {
      renderProfile({ discogsOutcome: 'expired' });

      expect(screen.getByText(/expired/i)).toBeInTheDocument();
    });

    it('shows a generic message for other errors', () => {
      renderProfile({ discogsOutcome: 'error' });

      expect(screen.getByText(/something went wrong/i)).toBeInTheDocument();
    });
  });
});
