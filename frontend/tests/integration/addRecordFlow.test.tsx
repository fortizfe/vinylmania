import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AddRecordPage } from '../../src/pages/AddRecordPage';

const mockSearch = vi.fn();
const mockCreate = vi.fn();

vi.mock('../../src/services/discogsApi', () => ({
  search: (...args: unknown[]) => mockSearch(...args),
}));

vi.mock('../../src/services/libraryApi', () => ({
  create: (...args: unknown[]) => mockCreate(...args),
}));

function LibraryListStub() {
  return <p>Library list</p>;
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/app/add']}>
      <Routes>
        <Route path="/app/add" element={<AddRecordPage />} />
        <Route path="/app" element={<LibraryListStub />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('Add record flow (US1)', () => {
  beforeEach(() => {
    mockSearch.mockReset();
    mockCreate.mockReset();
  });

  it('searches Discogs, lets the collector pick a result, and adds it to the library', async () => {
    mockSearch.mockResolvedValue({
      results: [
        {
          discogsId: 1,
          resultType: 'release',
          title: 'The Persuader - Stockholm',
          year: 1999,
          formats: ['Vinyl'],
        },
      ],
      pagination: { page: 1, pages: 1, items: 1, perPage: 50 },
    });
    mockCreate.mockResolvedValue({
      id: 'entry-1',
      discogsReleaseId: 1,
      addedAt: '2026-07-03T00:00:00.000Z',
      catalogStatus: 'ok',
      release: { discogsId: 1, title: 'Stockholm' },
    });

    renderPage();

    const user = userEvent.setup();
    await user.type(screen.getByRole('textbox', { name: /search/i }), 'Stockholm');
    await act(async () => {
      await user.click(screen.getByRole('button', { name: /search/i }));
    });

    await waitFor(() =>
      expect(screen.getByText(/the persuader - stockholm/i)).toBeInTheDocument(),
    );
    expect(mockSearch).toHaveBeenCalledWith('Stockholm', 'release');

    await act(async () => {
      await user.click(screen.getByRole('button', { name: /add to library/i }));
    });

    expect(mockCreate).toHaveBeenCalledWith(1);
    await waitFor(() => expect(screen.getByText('Library list')).toBeInTheDocument());
  });

  it('shows a clear empty state when the search has no matches', async () => {
    mockSearch.mockResolvedValue({
      results: [],
      pagination: { page: 1, pages: 0, items: 0, perPage: 50 },
    });

    renderPage();

    const user = userEvent.setup();
    await user.type(screen.getByRole('textbox', { name: /search/i }), 'zzzznomatch');
    await act(async () => {
      await user.click(screen.getByRole('button', { name: /search/i }));
    });

    await waitFor(() => expect(screen.getByText(/no results/i)).toBeInTheDocument());
  });
});
