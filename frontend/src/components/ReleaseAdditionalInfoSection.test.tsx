import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { ReleaseAdditionalInfoSection } from './ReleaseAdditionalInfoSection';

/**
 * Feature 063 · contracts/ui-contracts.md §C6 — the `community` prop and its
 * "{have} have / {want} want · rating …" line are removed; the community
 * have/want/rating now live in `RatingCard`. This card is now notes +
 * identifiers only.
 */
describe('ReleaseAdditionalInfoSection (trimmed — feature 063)', () => {
  it('renders identifiers when passed', () => {
    render(
      <ReleaseAdditionalInfoSection
        identifiers={[
          { type: 'Barcode', value: '7 39051 23421 6' },
          { type: 'Matrix / Runout', value: 'SK032-A', description: 'Side A Runout' },
        ]}
      />,
    );

    expect(screen.getByText(/Barcode/)).toBeInTheDocument();
    expect(screen.getByText(/7 39051 23421 6/)).toBeInTheDocument();
    expect(screen.getByText(/Side A Runout/)).toBeInTheDocument();
  });

  it('renders notes when passed', () => {
    render(
      <ReleaseAdditionalInfoSection
        notes="Recorded at Stockholm Sound Studio."
        identifiers={[]}
      />,
    );

    expect(
      screen.getByText('Recorded at Stockholm Sound Studio.'),
    ).toBeInTheDocument();
  });

  it('renders nothing when there are no notes and no identifiers', () => {
    const { container } = render(<ReleaseAdditionalInfoSection identifiers={[]} />);

    expect(container).toBeEmptyDOMElement();
  });

  it('shows no aggregate have / want / rating text anywhere', () => {
    render(
      <ReleaseAdditionalInfoSection
        notes="Some notes"
        identifiers={[{ type: 'Barcode', value: '123' }]}
      />,
    );

    expect(screen.queryByText(/\bhave\b/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/\bwant\b/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/rating/i)).not.toBeInTheDocument();
  });
});
