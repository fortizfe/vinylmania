import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { WantlistCard } from '../../src/components/WantlistCard';
import type { EnrichedWantEntry } from '../../src/services/wantlistApi';

const queryMocks = vi.hoisted(() => ({
  useRemoveFromWantlist: vi.fn(),
}));

vi.mock('../../src/queries/wantlistQueries', () => queryMocks);

/** Default: `mutate` resolves straight to its `onSuccess` callback. */
function stubRemoveMutation(
  overrides: Partial<{
    mutate: ReturnType<typeof vi.fn>;
    isPending: boolean;
    isError: boolean;
  }> = {},
) {
  const mutation = {
    mutate: vi.fn((_releaseId: number, opts?: { onSuccess?: () => void }) => {
      opts?.onSuccess?.();
    }),
    isPending: false,
    isError: false,
    ...overrides,
  };
  queryMocks.useRemoveFromWantlist.mockReturnValue(mutation);
  return mutation;
}

beforeEach(() => {
  vi.clearAllMocks();
  stubRemoveMutation();
});

function LocationProbe() {
  const location = useLocation();
  return (
    <div>
      <span data-testid="probe-pathname">{location.pathname}</span>
      <span data-testid="probe-state">{JSON.stringify(location.state)}</span>
    </div>
  );
}

function renderCard(entry: EnrichedWantEntry) {
  return render(
    <MemoryRouter initialEntries={['/app/wishlist']}>
      <Routes>
        <Route path="/app/wishlist" element={<WantlistCard entry={entry} />} />
        <Route path="/app/releases/:discogsId" element={<LocationProbe />} />
      </Routes>
    </MemoryRouter>,
  );
}

function buildEntry(overrides: Partial<EnrichedWantEntry> = {}): EnrichedWantEntry {
  return {
    discogsReleaseId: 42,
    rating: 3,
    notes: 'Original pressing only',
    addedAt: '2026-08-01T12:00:00.000Z',
    catalogStatus: 'ok',
    release: {
      discogsId: 42,
      title: 'Homework',
      artists: [{ discogsArtistId: 1, name: 'Daft Punk' }],
      labels: [],
      formats: [],
      genres: [],
      styles: [],
      identifiers: [],
      community: { have: 9000, want: 4000, rating: { average: 4.6, count: 512 } },
      tracklist: [],
      images: [{ url: 'https://example.com/homework.jpg', imageType: 'primary' }],
      discogsUrl: 'https://www.discogs.com/release/42',
    },
    ...overrides,
  };
}

describe('WantlistCard', () => {
  it('renders the release title, primary artist, and cover image', () => {
    const { container } = renderCard(buildEntry());

    expect(screen.getByText('Homework')).toBeInTheDocument();
    expect(screen.getByText('Daft Punk')).toBeInTheDocument();
    expect(container.querySelector('img')).toHaveAttribute(
      'src',
      'https://example.com/homework.jpg',
    );
  });

  it('shows the community rating in the badge (not the personal rating)', () => {
    renderCard(buildEntry({ rating: 1 }));

    // 4.6 community average -> "4.6"; the personal rating (1) must not appear.
    expect(
      screen.getByRole('status', { name: 'Rating 4.6 out of 5' }),
    ).toBeInTheDocument();
    expect(screen.getByText('4.6')).toBeInTheDocument();
    expect(screen.queryByText('1.0')).not.toBeInTheDocument();
  });

  it('shows the unrated placeholder badge when the release has no community rating', () => {
    const entry = buildEntry();
    delete entry.release!.community;
    renderCard(entry);

    expect(
      screen.getByRole('status', { name: 'Rating not available' }),
    ).toBeInTheDocument();
  });

  it('links the card to the release detail page', () => {
    renderCard(buildEntry());

    expect(screen.getByRole('link')).toHaveAttribute('href', '/app/releases/42');
  });

  it('passes the wishlist path as router state so the detail page can navigate back', async () => {
    const user = userEvent.setup();
    renderCard(buildEntry());

    await user.click(screen.getByRole('link'));

    expect(screen.getByTestId('probe-pathname')).toHaveTextContent('/app/releases/42');
    expect(screen.getByTestId('probe-state')).toHaveTextContent(
      JSON.stringify({ from: '/app/wishlist' }),
    );
  });

  it('gives the whole-card link a card press affordance', () => {
    renderCard(buildEntry());

    const link = screen.getByRole('link');
    expect(link.className).toMatch(/active:scale-\[0\.99\]/);
    expect(link.className).toMatch(/motion-reduce:active:scale-100/);
  });

  describe('unavailable catalog fallback', () => {
    it('renders a graceful fallback with an "Open release" link when the release is null', () => {
      renderCard(
        buildEntry({ catalogStatus: 'unavailable', release: null, discogsReleaseId: 77 }),
      );

      expect(screen.getByText(/couldn't load catalog details/i)).toBeInTheDocument();
      const link = screen.getByRole('link', { name: /open release/i });
      expect(link).toHaveAttribute('href', '/app/releases/77');
    });

    it('does not render a rating badge for an unavailable entry', () => {
      renderCard(buildEntry({ catalogStatus: 'unavailable', release: null }));

      expect(screen.queryByRole('status')).not.toBeInTheDocument();
    });

    it('still carries the wishlist router state on the fallback link', async () => {
      const user = userEvent.setup();
      renderCard(
        buildEntry({ catalogStatus: 'unavailable', release: null, discogsReleaseId: 77 }),
      );

      await user.click(screen.getByRole('link', { name: /open release/i }));

      expect(screen.getByTestId('probe-state')).toHaveTextContent(
        JSON.stringify({ from: '/app/wishlist' }),
      );
    });

    it('is still removable from the fallback card (uses discogsReleaseId, generic title)', async () => {
      const user = userEvent.setup();
      const mutation = stubRemoveMutation();
      renderCard(
        buildEntry({ catalogStatus: 'unavailable', release: null, discogsReleaseId: 77 }),
      );

      await user.click(screen.getByRole('button', { name: /remove from wishlist/i }));
      const dialog = screen.getByRole('dialog');
      await user.click(within(dialog).getByRole('button', { name: /^remove$/i }));

      expect(mutation.mutate).toHaveBeenCalledWith(77, expect.anything());
    });
  });

  describe('remove from wishlist (US4)', () => {
    it('offers an accessibly-named remove control on the card', () => {
      renderCard(buildEntry());

      expect(
        screen.getByRole('button', { name: /remove from wishlist/i }),
      ).toBeInTheDocument();
    });

    it('opens the confirmation dialog naming the release', async () => {
      const user = userEvent.setup();
      renderCard(buildEntry());

      await user.click(screen.getByRole('button', { name: /remove from wishlist/i }));

      const dialog = screen.getByRole('dialog');
      expect(dialog).toHaveAccessibleName(/remove from wishlist\?/i);
      expect(within(dialog).getByText(/homework/i)).toBeInTheDocument();
    });

    it('confirming removes the entry via its discogsReleaseId and closes the dialog', async () => {
      const user = userEvent.setup();
      const mutation = stubRemoveMutation();
      renderCard(buildEntry({ discogsReleaseId: 42 }));

      await user.click(screen.getByRole('button', { name: /remove from wishlist/i }));
      await user.click(
        within(screen.getByRole('dialog')).getByRole('button', { name: /^remove$/i }),
      );

      expect(mutation.mutate).toHaveBeenCalledWith(42, expect.anything());
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('keeps the card and shows the error when the removal fails', async () => {
      const user = userEvent.setup();
      stubRemoveMutation({
        mutate: vi.fn((_id: number, opts?: { onError?: (e: unknown) => void }) => {
          opts?.onError?.(new Error('discogs down'));
        }),
        isError: true,
      });
      renderCard(buildEntry());

      await user.click(screen.getByRole('button', { name: /remove from wishlist/i }));
      await user.click(
        within(screen.getByRole('dialog')).getByRole('button', { name: /^remove$/i }),
      );

      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(within(screen.getByRole('dialog')).getByRole('alert')).toHaveTextContent(
        /couldn't remove it right now/i,
      );
      expect(screen.getByRole('link', { name: /homework/i })).toBeInTheDocument();
    });

    it('dismissing the dialog leaves the entry untouched', async () => {
      const user = userEvent.setup();
      const mutation = stubRemoveMutation();
      renderCard(buildEntry());

      await user.click(screen.getByRole('button', { name: /remove from wishlist/i }));
      await user.click(
        within(screen.getByRole('dialog')).getByRole('button', { name: /^cancel$/i }),
      );

      expect(mutation.mutate).not.toHaveBeenCalled();
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });
});
