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

    const content = screen.getByTestId('record-detail-content');
    expect(content.className).toMatch(/grid-cols-1/);
    expect(content.className).toMatch(/lg:grid-cols-2/);

    // The whole page's content sits inside a single shared bordered surface (Card) —
    // none of the individual sections gets its own independent border (spec Clarifications).
    expect(content.parentElement?.className).toMatch(/rounded-xl/);
    expect(content.parentElement?.className).toMatch(/border/);

    const gallery = screen.getByTestId('record-detail-gallery');
    const details = screen.getByTestId('record-detail-details');
    const tracklist = screen.getByTestId('record-detail-tracklist');
    const additionalInfo = screen.getByTestId('record-detail-additional-info');

    expect(gallery.className).toMatch(/lg:col-span-2/);
    expect(details.parentElement?.className).toMatch(/lg:grid-cols-2/);
    expect(details.parentElement).toBe(tracklist.parentElement);
    expect(additionalInfo.className).toMatch(/lg:col-span-2/);

    [gallery, details, tracklist, additionalInfo].forEach((section) => {
      expect(section.className).not.toMatch(/rounded-xl/);
    });

    // DOM order: gallery, details (which contains my copy), tracklist, additional info.
    const order = [gallery, details, tracklist, additionalInfo];
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

  it('stacks gallery, key details, my copy, tracklist, and additional info in that DOM order (US3)', async () => {
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

    const main = screen.getByText('Stockholm').closest('main');
    const text = main?.textContent ?? '';
    expect(text.indexOf('No cover image available')).toBeLessThan(
      text.indexOf('Stockholm'),
    );
    expect(text.indexOf('Stockholm')).toBeLessThan(text.indexOf('Your copy'));
    expect(text.indexOf('Your copy')).toBeLessThan(text.indexOf('Östermalm'));
    expect(text.indexOf('Östermalm')).toBeLessThan(
      text.indexOf('Recorded at Stockholm Sound Studio.'),
    );
  });
});
