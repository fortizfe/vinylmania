import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { LibraryListPage } from '../../src/pages/LibraryListPage';

const mockList = vi.fn();

vi.mock('../../src/services/libraryApi', () => ({
  list: (...args: unknown[]) => mockList(...args),
}));

function renderPage() {
  return render(
    <MemoryRouter>
      <LibraryListPage />
    </MemoryRouter>,
  );
}

describe('Library list flow (US2)', () => {
  beforeEach(() => {
    mockList.mockReset();
  });

  it('renders every entry in the library', async () => {
    mockList.mockResolvedValue({
      items: [
        {
          id: 'entry-1',
          discogsReleaseId: 1,
          addedAt: '2026-07-03T00:00:00.000Z',
          catalogStatus: 'ok',
          release: {
            discogsId: 1,
            title: 'Stockholm',
            artists: [{ discogsArtistId: 1, name: 'The Persuader' }],
            labels: [],
            formats: [],
            genres: [],
            styles: [],
            tracklist: [],
            images: [],
            discogsUrl: 'https://www.discogs.com/release/1',
          },
        },
      ],
      page: 1,
      pageSize: 20,
      totalItems: 1,
    });

    renderPage();

    await waitFor(() => expect(screen.getByText('Stockholm')).toBeInTheDocument());
  });

  it('shows a clear empty state when the library has no entries', async () => {
    mockList.mockResolvedValue({ items: [], page: 1, pageSize: 20, totalItems: 0 });

    renderPage();

    await waitFor(() => expect(screen.getByText(/no records yet/i)).toBeInTheDocument());
  });
});
