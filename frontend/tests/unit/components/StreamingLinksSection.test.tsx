import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { StreamingLinksSection } from '../../../src/components/StreamingLinksSection';
import type { ReleaseIdentifier } from '../../../src/services/libraryApi';

const mockUseStreamingLinks = vi.fn();

vi.mock('../../../src/queries/streamingQueries', () => ({
  useStreamingLinks: (args: unknown) => mockUseStreamingLinks(args),
}));

type QueryResultShape = {
  data?: { links: Array<{ platform: string; url: string }> };
  isLoading: boolean;
  isError: boolean;
  isSuccess: boolean;
};

function queryResult(overrides: Partial<QueryResultShape> = {}): QueryResultShape {
  return {
    data: undefined,
    isLoading: false,
    isError: false,
    isSuccess: false,
    ...overrides,
  };
}

const APPLE_URL = 'https://music.apple.com/es/album/master-of-puppets/123';

describe('StreamingLinksSection (feature 062, US1)', () => {
  beforeEach(() => {
    mockUseStreamingLinks.mockReset();
  });

  it('shows a fixed-height skeleton while the query is loading and inputs are valid', () => {
    mockUseStreamingLinks.mockReturnValue(queryResult({ isLoading: true }));

    render(<StreamingLinksSection artist="Metallica" title="Master of Puppets" />);

    expect(screen.getByTestId('streaming-links-skeleton')).toBeInTheDocument();
    // A single reserved height on the outer Card so the skeleton -> populated /
    // collapsed transition does not shift the surrounding detail (FR-017).
    expect(screen.getByTestId('record-detail-streaming-card').className).toMatch(
      /min-h-/,
    );
    // Placement is the layout's job now (feature 063 US4 / T035): the card must
    // not carry its own grid-span override.
    expect(screen.getByTestId('record-detail-streaming-card').className).not.toMatch(
      /col-span/,
    );
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });

  it('renders a labelled section, a heading and an Apple Music link on a resolved match', () => {
    mockUseStreamingLinks.mockReturnValue(
      queryResult({
        isSuccess: true,
        data: { links: [{ platform: 'apple_music', url: APPLE_URL }] },
      }),
    );

    render(<StreamingLinksSection artist="Metallica" title="Master of Puppets" />);

    // No hard-coded `lg:col-span-2` — `RecordDetailLayout` owns placement (T035).
    expect(screen.getByTestId('record-detail-streaming-card').className).not.toMatch(
      /col-span/,
    );

    // <h2>: on the record-detail views every content card carries an <h2>
    // under the page <h1>, no skipped level (feature 063 §C7).
    const heading = screen.getByRole('heading', { level: 2, name: /streaming/i });
    const region = screen.getByRole('region', { name: /streaming/i });
    expect(region.tagName).toBe('SECTION');
    expect(region).toContainElement(heading);

    const link = screen.getByRole('link', { name: 'Escuchar en Apple Music' });
    expect(link).toHaveAttribute('href', APPLE_URL);
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    // Meaning is not carried by icon shape / colour alone: a visible text label
    // and an accessible name are both present (Constitution X / FR-018).
    expect(link).toHaveTextContent('Apple Music');
    // Visible focus treatment (the shared focus ring).
    expect(link.className).toMatch(/focus-visible:ring/);
  });

  it('renders nothing when the resolver returned no links (confirmed no-match)', () => {
    mockUseStreamingLinks.mockReturnValue(
      queryResult({ isSuccess: true, data: { links: [] } }),
    );

    const { container } = render(
      <StreamingLinksSection artist="Metallica" title="Master of Puppets" />,
    );

    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing when the query errored (transient failure degrades silently)', () => {
    mockUseStreamingLinks.mockReturnValue(queryResult({ isError: true }));

    const { container } = render(
      <StreamingLinksSection artist="Metallica" title="Master of Puppets" />,
    );

    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing when artist or title is missing', () => {
    mockUseStreamingLinks.mockReturnValue(queryResult());

    const { container } = render(<StreamingLinksSection title="Master of Puppets" />);

    expect(container).toBeEmptyDOMElement();
  });

  it('derives barcodes from identifiers where type === "Barcode"', () => {
    mockUseStreamingLinks.mockReturnValue(
      queryResult({ isSuccess: true, data: { links: [] } }),
    );
    const identifiers: ReleaseIdentifier[] = [
      { type: 'Barcode', value: '075596060721' },
      { type: 'Matrix / Runout', value: 'ABC-123-X' },
      { type: 'Barcode', value: '5 099747 851827' },
    ];

    render(
      <StreamingLinksSection
        identifiers={identifiers}
        artist="Metallica"
        title="Master of Puppets"
      />,
    );

    expect(mockUseStreamingLinks).toHaveBeenCalledWith({
      barcodes: ['075596060721', '5 099747 851827'],
      artist: 'Metallica',
      title: 'Master of Puppets',
    });
  });

  it('passes an empty barcode list when there are no identifiers (e.g. a master)', () => {
    mockUseStreamingLinks.mockReturnValue(
      queryResult({ isSuccess: true, data: { links: [] } }),
    );

    render(<StreamingLinksSection artist="Metallica" title="Master of Puppets" />);

    expect(mockUseStreamingLinks).toHaveBeenCalledWith({
      barcodes: [],
      artist: 'Metallica',
      title: 'Master of Puppets',
    });
  });

  it('ignores links for platforms it has no display metadata for', () => {
    mockUseStreamingLinks.mockReturnValue(
      queryResult({
        isSuccess: true,
        data: {
          links: [
            { platform: 'wolfs_lair_records', url: 'https://example.test/album/x' },
          ],
        },
      }),
    );

    const { container } = render(
      <StreamingLinksSection artist="Metallica" title="Master of Puppets" />,
    );

    expect(container).toBeEmptyDOMElement();
  });
});

describe('StreamingLinksSection (feature 062, US3 — never a broken or misleading link)', () => {
  beforeEach(() => {
    mockUseStreamingLinks.mockReset();
  });

  it('renders nothing on a query error: no alert, no spinner, nothing left mounted', () => {
    mockUseStreamingLinks.mockReturnValue(queryResult({ isError: true }));

    const { container } = render(
      <StreamingLinksSection artist="Metallica" title="Master of Puppets" />,
    );

    // A transient failure degrades silently — no error text, no perpetual
    // spinner, no residual node at all (FR-014).
    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    expect(screen.queryByTestId('streaming-links-skeleton')).not.toBeInTheDocument();
  });

  it('reserves the same outer height for the skeleton and the populated state (FR-017)', () => {
    mockUseStreamingLinks.mockReturnValue(queryResult({ isLoading: true }));

    const { rerender } = render(
      <StreamingLinksSection artist="Metallica" title="Master of Puppets" />,
    );

    const loadingCard = screen.getByTestId('record-detail-streaming-card');
    expect(loadingCard.className).toMatch(/min-h-\[4\.5rem\]/);
    expect(screen.getByTestId('streaming-links-skeleton')).toBeInTheDocument();

    mockUseStreamingLinks.mockReturnValue(
      queryResult({
        isSuccess: true,
        data: { links: [{ platform: 'apple_music', url: APPLE_URL }] },
      }),
    );
    rerender(<StreamingLinksSection artist="Metallica" title="Master of Puppets" />);

    const populatedCard = screen.getByTestId('record-detail-streaming-card');
    expect(populatedCard.className).toMatch(/min-h-\[4\.5rem\]/);
    // The single shared reserved-height class means the skeleton -> populated
    // swap cannot push the surrounding detail around.
    expect(populatedCard.className).toBe(loadingCard.className);
  });
});

describe('StreamingLinksSection (feature 062, US4 — ready for more platforms)', () => {
  beforeEach(() => {
    mockUseStreamingLinks.mockReset();
  });

  it('renders one anchor per link, in list order, from the metadata map', () => {
    mockUseStreamingLinks.mockReturnValue(
      queryResult({
        isSuccess: true,
        data: {
          links: [
            { platform: 'apple_music', url: 'https://music.apple.com/a' },
            { platform: 'spotify', url: 'https://open.spotify.com/b' },
          ],
        },
      }),
    );

    render(<StreamingLinksSection artist="Metallica" title="Master of Puppets" />);

    const names = screen.getAllByRole('link').map((a) => a.getAttribute('aria-label'));
    expect(names).toEqual(['Escuchar en Apple Music', 'Escuchar en Spotify']);
  });

  it('follows the links[] order, not an Apple-Music-first special case', () => {
    mockUseStreamingLinks.mockReturnValue(
      queryResult({
        isSuccess: true,
        data: {
          links: [
            { platform: 'spotify', url: 'https://open.spotify.com/b' },
            { platform: 'apple_music', url: 'https://music.apple.com/a' },
          ],
        },
      }),
    );

    render(<StreamingLinksSection artist="Metallica" title="Master of Puppets" />);

    const names = screen.getAllByRole('link').map((a) => a.getAttribute('aria-label'));
    expect(names).toEqual(['Escuchar en Spotify', 'Escuchar en Apple Music']);
  });

  it('skips an entry with an unregistered platform id without throwing or leaving an empty item', () => {
    mockUseStreamingLinks.mockReturnValue(
      queryResult({
        isSuccess: true,
        data: {
          links: [
            { platform: 'apple_music', url: 'https://music.apple.com/a' },
            { platform: 'some_new_service', url: 'https://example.test/c' },
            { platform: 'spotify', url: 'https://open.spotify.com/b' },
          ],
        },
      }),
    );

    render(<StreamingLinksSection artist="Metallica" title="Master of Puppets" />);

    expect(screen.getAllByRole('listitem')).toHaveLength(2);
    const names = screen.getAllByRole('link').map((a) => a.getAttribute('aria-label'));
    expect(names).toEqual(['Escuchar en Apple Music', 'Escuchar en Spotify']);
  });
});
