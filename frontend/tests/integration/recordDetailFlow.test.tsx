import { QueryClientProvider } from '@tanstack/react-query';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { RecordDetailPage } from '../../src/pages/RecordDetailPage';
import { createTestQueryClient } from '../testUtils';

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
    <QueryClientProvider client={createTestQueryClient()}>
      <MemoryRouter initialEntries={['/app/library/records/entry-1']}>
        <Routes>
          <Route path="/app/library/records/:entryId" element={<RecordDetailPage />} />
          <Route path="/app/library" element={<LibraryListStub />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
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
      catalogStatus: 'ok',
      discogs: {
        instanceId: 11,
        folderId: 1,
        rating: 0,
        mediaCondition: 'Near Mint (NM or M-)',
        sleeveCondition: null,
        notes: 'Bought at a record fair',
        editable: { mediaCondition: true, sleeveCondition: true, notes: true },
      },
      release: {
        discogsId: 1,
        title: 'Stockholm',
        artists: [{ discogsArtistId: 1, name: 'The Persuader' }],
        labels: [{ discogsLabelId: 5, name: 'Svek', catalogNumber: 'SK032' }],
        formats: [{ name: 'Vinyl', descriptions: ['12"'] }],
        genres: ['Electronic'],
        styles: ['Deep House'],
        tracklist: [{ position: 'A', title: 'Östermalm', duration: '4:45' }],
        identifiers: [],
        images: [],
        discogsUrl: 'https://www.discogs.com/release/1',
      },
    });

    renderPage();

    await waitFor(() => expect(screen.getByText('Stockholm')).toBeInTheDocument());
    expect(screen.getByText('The Persuader')).toBeInTheDocument();
    expect(screen.getByText(/Östermalm/)).toBeInTheDocument();
    const mediaSelect = screen.getByLabelText('Media Condition') as HTMLSelectElement;
    expect(mediaSelect.value).toBe('Near Mint (NM or M-)');
    expect(screen.getByText(/Bought at a record fair/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /back/i })).toHaveAttribute(
      'href',
      '/app/library',
    );
  });

  it('shows a skeleton placeholder while the record is loading, then replaces it with content', async () => {
    let resolveGetOne!: (value: unknown) => void;
    mockGetOne.mockReturnValue(
      new Promise((resolve) => {
        resolveGetOne = resolve;
      }),
    );

    renderPage();

    expect(screen.getByTestId('record-detail-skeleton')).toBeInTheDocument();

    resolveGetOne({
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
        identifiers: [],
        images: [],
        discogsUrl: 'https://www.discogs.com/release/1',
      },
    });

    await waitFor(() => expect(screen.getByText('Stockholm')).toBeInTheDocument());
    expect(screen.queryByTestId('record-detail-skeleton')).not.toBeInTheDocument();
  });

  it('shows a not-found state for an entry that does not exist', async () => {
    mockGetOne.mockRejectedValue({ status: 404, code: 'entry_not_found' });

    renderPage();

    await waitFor(() =>
      expect(screen.getByText(/couldn't find that record/i)).toBeInTheDocument(),
    );
  });

  it('shows an explanatory message plus an editable my-copy section when catalog details are unavailable (US4)', async () => {
    mockGetOne.mockResolvedValue({
      id: 'entry-1',
      discogsReleaseId: 1,
      addedAt: '2026-07-03T00:00:00.000Z',
      catalogStatus: 'unavailable',
      discogs: {
        instanceId: 11,
        folderId: 1,
        rating: 0,
        mediaCondition: 'Good (G)',
        sleeveCondition: null,
        notes: 'Original notes',
        editable: { mediaCondition: true, sleeveCondition: true, notes: true },
      },
      release: null,
    });

    renderPage();

    await waitFor(() =>
      expect(screen.getByText(/couldn't load catalog details/i)).toBeInTheDocument(),
    );
    expect(screen.getByText('Your copy')).toBeInTheDocument();
    const mediaSelect = screen.getByLabelText('Media Condition') as HTMLSelectElement;
    expect(mediaSelect.value).toBe('Good (G)');
    expect(screen.getByText(/Original notes/)).toBeInTheDocument();
  });

  it('omits the key-details meta row and tracklist section when that data is missing, while title/artist and my copy still render (US4)', async () => {
    mockGetOne.mockResolvedValue({
      id: 'entry-1',
      discogsReleaseId: 1,
      addedAt: '2026-07-03T00:00:00.000Z',
      catalogStatus: 'ok',
      discogs: null,
      release: {
        discogsId: 1,
        title: 'Stockholm',
        artists: [{ discogsArtistId: 1, name: 'The Persuader' }],
        labels: [],
        formats: [],
        genres: [],
        styles: [],
        identifiers: [],
        tracklist: [],
        images: [],
        discogsUrl: 'https://www.discogs.com/release/1',
      },
    });

    renderPage();

    await waitFor(() => expect(screen.getByText('Stockholm')).toBeInTheDocument());

    expect(screen.getByText('The Persuader')).toBeInTheDocument();
    expect(screen.getByText('Your copy')).toBeInTheDocument();
    expect(screen.queryByText('Tracklist')).not.toBeInTheDocument();
    expect(screen.queryByText(/No tracklist available/i)).not.toBeInTheDocument();
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
        identifiers: [],
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
        identifiers: [],
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

  it('edits media condition via select and calls update with the new value (US2)', async () => {
    const baseDiscogs = {
      instanceId: 11,
      folderId: 1,
      rating: 0,
      mediaCondition: 'Good (G)',
      sleeveCondition: null,
      notes: 'Original notes',
      editable: { mediaCondition: true, sleeveCondition: true, notes: true },
    };
    const baseEntry = {
      id: 'entry-1',
      discogsReleaseId: 1,
      addedAt: '2026-07-03T00:00:00.000Z',
      catalogStatus: 'ok' as const,
      discogs: baseDiscogs,
      release: {
        discogsId: 1,
        title: 'Stockholm',
        artists: [],
        labels: [],
        formats: [],
        genres: [],
        styles: [],
        tracklist: [],
        identifiers: [],
        images: [],
        discogsUrl: 'https://www.discogs.com/release/1',
      },
    };
    mockGetOne.mockResolvedValue(baseEntry);
    mockUpdate.mockResolvedValue({
      ...baseEntry,
      discogs: { ...baseDiscogs, mediaCondition: 'Mint (M)' },
    });

    renderPage();

    await waitFor(() => expect(screen.getByText('Stockholm')).toBeInTheDocument());

    const user = userEvent.setup();
    await user.selectOptions(screen.getByLabelText('Media Condition'), 'Mint (M)');

    expect(mockUpdate).toHaveBeenCalledWith('entry-1', { mediaCondition: 'Mint (M)' });
  });

  it('edits notes inline and reverts on Escape without saving (US2)', async () => {
    const baseEntry = {
      id: 'entry-1',
      discogsReleaseId: 1,
      addedAt: '2026-07-03T00:00:00.000Z',
      catalogStatus: 'ok' as const,
      discogs: {
        instanceId: 11,
        folderId: 1,
        rating: 0,
        mediaCondition: null,
        sleeveCondition: null,
        notes: 'Original notes',
        editable: { mediaCondition: true, sleeveCondition: true, notes: true },
      },
      release: {
        discogsId: 1,
        title: 'Stockholm',
        artists: [],
        labels: [],
        formats: [],
        genres: [],
        styles: [],
        tracklist: [],
        identifiers: [],
        images: [],
        discogsUrl: 'https://www.discogs.com/release/1',
      },
    };
    mockGetOne.mockResolvedValue(baseEntry);

    renderPage();

    await waitFor(() => expect(screen.getByText(/Original notes/)).toBeInTheDocument());

    const user = userEvent.setup();
    await user.click(screen.getByText('Original notes'));
    const notesField = screen.getByLabelText('Notes');
    await user.clear(notesField);
    await user.type(notesField, 'Discarded edit');
    await user.keyboard('{Escape}');

    expect(mockUpdate).not.toHaveBeenCalled();
    expect(screen.getByText('Original notes')).toBeInTheDocument();
  });

  it('renders the gallery, key details, tracklist, and additional info in the same structure as the release preview (US1)', async () => {
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
        notes: 'Recorded at Stockholm Sound Studio.',
        identifiers: [{ type: 'Barcode', value: '7 39051 23421 6' }],
        community: { have: 214, want: 58, rating: { average: 4.3, count: 37 } },
        tracklist: [{ position: 'A', title: 'Östermalm', duration: '4:45' }],
        images: [],
        discogsUrl: 'https://www.discogs.com/release/1',
      },
    });

    renderPage();

    await waitFor(() => expect(screen.getByText('Stockholm')).toBeInTheDocument());

    const gallery = screen.getByTestId('record-detail-gallery-card');
    const mainInfo = screen.getByTestId('record-detail-main-info-card');
    const yourCopy = screen.getByTestId('record-detail-your-copy-card');
    const tracklist = screen.getByTestId('record-detail-tracklist-card');
    const otherDetails = screen.getByTestId('record-detail-other-details-card');

    // Each content group is its own card (spec 057) — no single outer
    // wrapping card, and every card carries its own border/elevation plus
    // dark-mode classes (FR-011: dark theme legibility regression guard).
    [gallery, mainInfo, yourCopy, tracklist, otherDetails].forEach((card) => {
      expect(card.className).toMatch(/rounded-xl/);
      expect(card.className).toMatch(/border/);
      expect(card.className).toMatch(/dark:border-border-dark/);
      expect(card.className).toMatch(/dark:bg-surface-raised/);
    });

    // The two columns are rendered by the shared `DetailColumns` component
    // (spec 064): a left wrapper holding gallery + tracklist + other-details,
    // and a right wrapper holding main info + your copy, each a plain
    // `flex flex-col gap-4` column, laid out side by side by an outer
    // `grid grid-cols-1 lg:grid-cols-2 gap-4`. Nothing spans both columns
    // any more — the old full-width row behavior is gone.
    const leftColumn = gallery.parentElement;
    const rightColumn = mainInfo.parentElement;
    expect(leftColumn).not.toBe(rightColumn);
    expect(tracklist.parentElement).toBe(leftColumn);
    expect(otherDetails.parentElement).toBe(leftColumn);
    expect(yourCopy.parentElement).toBe(rightColumn);

    expect(leftColumn?.className).toMatch(/flex/);
    expect(leftColumn?.className).toMatch(/flex-col/);
    expect(leftColumn?.className).toMatch(/gap-4/);
    expect(rightColumn?.className).toMatch(/flex/);
    expect(rightColumn?.className).toMatch(/flex-col/);
    expect(rightColumn?.className).toMatch(/gap-4/);

    const outerGrid = leftColumn?.parentElement;
    expect(rightColumn?.parentElement).toBe(outerGrid);
    expect(outerGrid?.className).toMatch(/grid-cols-1/);
    expect(outerGrid?.className).toMatch(/lg:grid-cols-2/);
    expect(outerGrid?.className).toMatch(/gap-4/);

    expect(gallery.className).not.toMatch(/lg:col-span/);
    expect(tracklist.className).not.toMatch(/lg:col-span/);
    expect(otherDetails.className).not.toMatch(/lg:col-span/);
    expect(mainInfo.className).not.toMatch(/lg:col-span/);
    expect(yourCopy.className).not.toMatch(/lg:col-span/);

    // DOM order: gallery, tracklist, other details (left column), then
    // main info, your copy (right column) — the fixed order from
    // research.md Decision 3/5.
    const order = [gallery, tracklist, otherDetails, mainInfo, yourCopy];
    for (let i = 0; i < order.length - 1; i += 1) {
      expect(
        order[i].compareDocumentPosition(order[i + 1]) & Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
    }

    expect(screen.getByText(/Östermalm/)).toBeInTheDocument();
    expect(screen.getByText('Recorded at Stockholm Sound Studio.')).toBeInTheDocument();
    expect(screen.getByText(/Barcode/)).toBeInTheDocument();
    expect(screen.getByText(/214/)).toBeInTheDocument();
  });

  it('omits the other-details card entirely when the release has no notes, identifiers, or community data', async () => {
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
        identifiers: [],
        tracklist: [{ position: 'A', title: 'Östermalm', duration: '4:45' }],
        images: [],
        discogsUrl: 'https://www.discogs.com/release/1',
      },
    });

    renderPage();

    await waitFor(() => expect(screen.getByText('Stockholm')).toBeInTheDocument());

    expect(screen.getByTestId('record-detail-gallery-card')).toBeInTheDocument();
    expect(screen.getByTestId('record-detail-main-info-card')).toBeInTheDocument();
    expect(screen.getByTestId('record-detail-tracklist-card')).toBeInTheDocument();
    expect(
      screen.queryByTestId('record-detail-other-details-card'),
    ).not.toBeInTheDocument();
  });

  it('shows every credited artist, format descriptor, genre, style, label, and date when there is more than one (US1)', async () => {
    mockGetOne.mockResolvedValue({
      id: 'entry-1',
      discogsReleaseId: 1,
      addedAt: '2026-07-03T00:00:00.000Z',
      catalogStatus: 'ok',
      release: {
        discogsId: 1,
        title: 'Stockholm',
        country: 'Sweden',
        releaseDate: '1999-05-01',
        artists: [
          { discogsArtistId: 1, name: 'The Persuader' },
          { discogsArtistId: 2, name: 'Rune Lindbæk' },
        ],
        labels: [{ discogsLabelId: 5, name: 'Svek', catalogNumber: 'SK032' }],
        formats: [
          { name: 'Vinyl', descriptions: ['12"'] },
          { name: 'File', descriptions: ['MP3'] },
        ],
        genres: ['Electronic', 'House'],
        styles: ['Deep House'],
        tracklist: [],
        identifiers: [],
        images: [],
        discogsUrl: 'https://www.discogs.com/release/1',
      },
    });

    renderPage();

    await waitFor(() => expect(screen.getByText('Stockholm')).toBeInTheDocument());

    expect(screen.getByText(/The Persuader/)).toBeInTheDocument();
    expect(screen.getByText(/Rune Lindbæk/)).toBeInTheDocument();
    expect(screen.getByText(/Vinyl/)).toBeInTheDocument();
    expect(screen.getByText(/File/)).toBeInTheDocument();
    expect(screen.getByText('Electronic')).toBeInTheDocument();
    expect(screen.getByText('House')).toBeInTheDocument();
    expect(screen.getByText('Deep House')).toBeInTheDocument();
    expect(screen.getByText('Sweden')).toBeInTheDocument();
    expect(screen.getByText('1999-05-01')).toBeInTheDocument();
    expect(screen.getByText(/Svek/)).toBeInTheDocument();
  });

  it('stacks gallery, tracklist, and additional info before key details and my copy, in that fixed DOM order (US3, spec 064)', async () => {
    // Per spec 064 research.md Decision 3/5, cards are grouped into fixed
    // left/right columns (gallery, tracklist, additional-info vs. main
    // info, your copy), rendered by the shared `DetailColumns` component.
    // Below `lg` this collapses to a single stack in that same fixed
    // order — no longer the old interleaved
    // gallery/main-info/your-copy/tracklist/additional-info order.
    mockGetOne.mockResolvedValue({
      id: 'entry-1',
      discogsReleaseId: 1,
      addedAt: '2026-07-03T00:00:00.000Z',
      catalogStatus: 'ok',
      discogs: null,
      release: {
        discogsId: 1,
        title: 'Stockholm',
        artists: [{ discogsArtistId: 1, name: 'The Persuader' }],
        labels: [],
        formats: [],
        genres: [],
        styles: [],
        notes: 'Recorded at Stockholm Sound Studio.',
        identifiers: [],
        tracklist: [{ position: 'A', title: 'Östermalm', duration: '4:45' }],
        images: [],
        discogsUrl: 'https://www.discogs.com/release/1',
      },
    });

    renderPage();

    await waitFor(() => expect(screen.getByText('Stockholm')).toBeInTheDocument());

    const gallery = screen.getByTestId('record-detail-gallery-card');
    const tracklist = screen.getByTestId('record-detail-tracklist-card');
    const otherDetails = screen.getByTestId('record-detail-other-details-card');
    const mainInfo = screen.getByTestId('record-detail-main-info-card');
    const yourCopy = screen.getByTestId('record-detail-your-copy-card');

    const order = [gallery, tracklist, otherDetails, mainInfo, yourCopy];
    for (let i = 0; i < order.length - 1; i += 1) {
      expect(
        order[i].compareDocumentPosition(order[i + 1]) & Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
    }
  });
});
