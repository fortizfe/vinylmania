import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ProfilePage } from '../../src/pages/ProfilePage';

const mocks = vi.hoisted(() => ({
  useDiscogsStatus: vi.fn(),
  useRequestDiscogsLink: vi.fn(),
  useDisconnectDiscogs: vi.fn(),
  useThemePreference: vi.fn(),
}));

vi.mock('../../src/queries/discogsOauthQueries', () => mocks);
vi.mock('../../src/theme/useThemePreference', () => ({
  useThemePreference: mocks.useThemePreference,
}));

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
  mocks.useThemePreference.mockReturnValue({
    theme: 'light',
    toggle: vi.fn(),
    saveFailed: false,
  });
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

  describe('Preferences section', () => {
    it('renders a Preferences section with the theme toggle as its first control', () => {
      renderProfile();

      const section = screen.getByRole('region', { name: 'Preferences' });
      const toggle = screen.getByRole('switch', { name: /dark mode/i });
      expect(section).toContainElement(toggle);

      const firstControl = section.querySelector('input, button, [role="switch"]');
      expect(firstControl).toBe(toggle);
    });

    it('shows a dismissible warning banner when the preference save has persistently failed', async () => {
      const user = userEvent.setup();
      mocks.useThemePreference.mockReturnValue({
        theme: 'dark',
        toggle: vi.fn(),
        saveFailed: true,
      });

      renderProfile();

      const notice = screen.getByText(/preference may not have been saved/i);
      expect(notice).toBeInTheDocument();

      const toggle = screen.getByRole('switch', { name: /dark mode/i });
      expect(toggle).toBeEnabled();

      const dismissButtons = screen.getAllByRole('button', { name: /dismiss/i });
      await user.click(dismissButtons[dismissButtons.length - 1]);
      expect(screen.queryByText(/preference may not have been saved/i)).not.toBeInTheDocument();
    });

    it('shows no failure banner when the save has not failed', () => {
      mocks.useThemePreference.mockReturnValue({
        theme: 'light',
        toggle: vi.fn(),
        saveFailed: false,
      });

      renderProfile();

      expect(screen.queryByText(/preference may not have been saved/i)).not.toBeInTheDocument();
    });
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
