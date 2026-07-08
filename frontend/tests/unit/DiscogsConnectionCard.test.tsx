import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { DiscogsConnectionCard } from '../../src/components/DiscogsConnectionCard';

const mocks = vi.hoisted(() => ({
  useDiscogsStatus: vi.fn(),
  useRequestDiscogsLink: vi.fn(),
  useDisconnectDiscogs: vi.fn(),
}));

vi.mock('../../src/queries/discogsOauthQueries', () => mocks);

const idle = { mutate: vi.fn(), isPending: false };

beforeEach(() => {
  vi.clearAllMocks();
  mocks.useRequestDiscogsLink.mockReturnValue({ ...idle, mutate: vi.fn() });
  mocks.useDisconnectDiscogs.mockReturnValue({ ...idle, mutate: vi.fn() });
});

describe('DiscogsConnectionCard', () => {
  it('renders a skeleton while the status is loading', () => {
    mocks.useDiscogsStatus.mockReturnValue({
      data: undefined,
      isPending: true,
      isError: false,
    });

    render(<DiscogsConnectionCard />);

    expect(screen.getByTestId('discogs-connection-skeleton')).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('shows the not-connected state with a link action', async () => {
    const user = userEvent.setup();
    const requestMutate = vi.fn();
    mocks.useDiscogsStatus.mockReturnValue({
      data: { connected: false },
      isPending: false,
      isError: false,
    });
    mocks.useRequestDiscogsLink.mockReturnValue({
      mutate: requestMutate,
      isPending: false,
    });

    render(<DiscogsConnectionCard />);

    expect(screen.getByText(/not connected/i)).toBeInTheDocument();
    const linkButton = screen.getByRole('button', { name: /connect discogs account/i });
    await user.click(linkButton);
    expect(requestMutate).toHaveBeenCalledTimes(1);
  });

  it('shows the connected state with the Discogs username and linked date, and no link action', () => {
    mocks.useDiscogsStatus.mockReturnValue({
      data: {
        connected: true,
        discogsUsername: 'discogs-jane',
        linkedAt: '2026-07-06T09:00:00.000Z',
      },
      isPending: false,
      isError: false,
    });

    render(<DiscogsConnectionCard />);

    expect(screen.getByText('discogs-jane')).toBeInTheDocument();
    expect(screen.getByText(/connected/i)).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /connect discogs account/i }),
    ).not.toBeInTheDocument();
  });

  describe('disconnect (US2)', () => {
    const connected = {
      data: {
        connected: true,
        discogsUsername: 'discogs-jane',
        linkedAt: '2026-07-06T09:00:00.000Z',
      },
      isPending: false,
      isError: false,
    };

    it('reveals an inline confirm step on Disconnect and fires the mutation on confirm (2 interactions)', async () => {
      const user = userEvent.setup();
      const disconnectMutate = vi.fn();
      mocks.useDiscogsStatus.mockReturnValue(connected);
      mocks.useDisconnectDiscogs.mockReturnValue({
        mutate: disconnectMutate,
        isPending: false,
      });

      render(<DiscogsConnectionCard />);

      await user.click(screen.getByRole('button', { name: /^disconnect$/i }));
      expect(disconnectMutate).not.toHaveBeenCalled();

      await user.click(screen.getByRole('button', { name: /confirm disconnect/i }));
      expect(disconnectMutate).toHaveBeenCalledTimes(1);
    });

    it('restores the card when the confirm step is cancelled', async () => {
      const user = userEvent.setup();
      const disconnectMutate = vi.fn();
      mocks.useDiscogsStatus.mockReturnValue(connected);
      mocks.useDisconnectDiscogs.mockReturnValue({
        mutate: disconnectMutate,
        isPending: false,
      });

      render(<DiscogsConnectionCard />);

      await user.click(screen.getByRole('button', { name: /^disconnect$/i }));
      await user.click(screen.getByRole('button', { name: /keep connection/i }));

      expect(disconnectMutate).not.toHaveBeenCalled();
      expect(screen.getByRole('button', { name: /^disconnect$/i })).toBeInTheDocument();
    });
  });
});
