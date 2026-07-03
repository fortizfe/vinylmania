import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { RecordDetailPage } from '../../src/pages/RecordDetailPage';

const mockGetOne = vi.fn();
const mockRemove = vi.fn();
const mockUpdate = vi.fn();

vi.mock('../../src/services/libraryApi', () => ({
  getOne: (...args: unknown[]) => mockGetOne(...args),
  remove: (...args: unknown[]) => mockRemove(...args),
  update: (...args: unknown[]) => mockUpdate(...args),
}));

function LibraryListStub() {
  return <p>Library list</p>;
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/app/records/entry-1']}>
      <Routes>
        <Route path="/app/records/:entryId" element={<RecordDetailPage />} />
        <Route path="/app" element={<LibraryListStub />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('Record detail flow (US3)', () => {
  beforeEach(() => {
    mockGetOne.mockReset();
    mockRemove.mockReset();
    mockUpdate.mockReset();
  });

  it('shows the merged catalog detail alongside personal notes', async () => {
    mockGetOne.mockResolvedValue({
      id: 'entry-1',
      discogsReleaseId: 1,
      addedAt: '2026-07-03T00:00:00.000Z',
      condition: 'Near Mint',
      notes: 'Bought at a record fair',
      catalogStatus: 'ok',
      release: {
        discogsId: 1,
        title: 'Stockholm',
        artists: [{ discogsArtistId: 1, name: 'The Persuader' }],
        labels: [{ discogsLabelId: 5, name: 'Svek', catalogNumber: 'SK032' }],
        formats: [{ name: 'Vinyl', descriptions: ['12"'] }],
        genres: ['Electronic'],
        styles: ['Deep House'],
        tracklist: [{ position: 'A', title: 'Östermalm', duration: '4:45' }],
        images: [],
        discogsUrl: 'https://www.discogs.com/release/1',
      },
    });

    renderPage();

    await waitFor(() => expect(screen.getByText('Stockholm')).toBeInTheDocument());
    expect(screen.getByText('The Persuader')).toBeInTheDocument();
    expect(screen.getByText(/Östermalm/)).toBeInTheDocument();
    expect(screen.getByText(/Near Mint/)).toBeInTheDocument();
    expect(screen.getByText(/Bought at a record fair/)).toBeInTheDocument();
  });

  it('shows a not-found state for an entry that does not exist', async () => {
    mockGetOne.mockRejectedValue({ status: 404, code: 'entry_not_found' });

    renderPage();

    await waitFor(() => expect(screen.getByText(/couldn't find that record/i)).toBeInTheDocument());
  });

  it('removes the record after confirmation and returns to the library', async () => {
    mockGetOne.mockResolvedValue({
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
    });
    mockRemove.mockResolvedValue(undefined);
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    renderPage();

    await waitFor(() => expect(screen.getByText('Stockholm')).toBeInTheDocument());

    const user = userEvent.setup();
    await act(async () => {
      await user.click(screen.getByRole('button', { name: /remove from library/i }));
    });

    expect(mockRemove).toHaveBeenCalledWith('entry-1');
    await waitFor(() => expect(screen.getByText('Library list')).toBeInTheDocument());
  });

  it('does not remove the record when the collector cancels the confirmation', async () => {
    mockGetOne.mockResolvedValue({
      id: 'entry-1',
      discogsReleaseId: 1,
      addedAt: '2026-07-03T00:00:00.000Z',
      catalogStatus: 'ok',
      release: {
        discogsId: 1,
        title: 'Stockholm',
        artists: [],
        labels: [],
        formats: [],
        genres: [],
        styles: [],
        tracklist: [],
        images: [],
        discogsUrl: 'https://www.discogs.com/release/1',
      },
    });
    vi.spyOn(window, 'confirm').mockReturnValue(false);

    renderPage();

    await waitFor(() => expect(screen.getByText('Stockholm')).toBeInTheDocument());

    const user = userEvent.setup();
    await act(async () => {
      await user.click(screen.getByRole('button', { name: /remove from library/i }));
    });

    expect(mockRemove).not.toHaveBeenCalled();
  });

  it('edits condition and notes and reflects the change afterward', async () => {
    const baseEntry = {
      id: 'entry-1',
      discogsReleaseId: 1,
      addedAt: '2026-07-03T00:00:00.000Z',
      condition: 'Good',
      notes: 'Original notes',
      catalogStatus: 'ok' as const,
      release: {
        discogsId: 1,
        title: 'Stockholm',
        artists: [],
        labels: [],
        formats: [],
        genres: [],
        styles: [],
        tracklist: [],
        images: [],
        discogsUrl: 'https://www.discogs.com/release/1',
      },
    };
    mockGetOne.mockResolvedValue(baseEntry);
    mockUpdate.mockResolvedValue({
      ...baseEntry,
      condition: 'Mint',
      notes: 'Regraded after cleaning',
    });

    renderPage();

    await waitFor(() => expect(screen.getByText(/Original notes/)).toBeInTheDocument());

    const user = userEvent.setup();
    await act(async () => {
      await user.click(screen.getByRole('button', { name: /edit/i }));
    });

    const notesField = screen.getByLabelText(/notes/i);
    await user.clear(notesField);
    await user.type(notesField, 'Regraded after cleaning');
    await user.selectOptions(screen.getByLabelText(/condition/i), 'Mint');

    await act(async () => {
      await user.click(screen.getByRole('button', { name: /save/i }));
    });

    expect(mockUpdate).toHaveBeenCalledWith('entry-1', 'Mint', 'Regraded after cleaning');
    await waitFor(() => expect(screen.getByText(/Regraded after cleaning/)).toBeInTheDocument());
  });
});
