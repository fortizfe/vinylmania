import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { ReleaseAdditionalInfoSection } from '../../src/components/ReleaseAdditionalInfoSection';

describe('ReleaseAdditionalInfoSection', () => {
  it('renders notes when present', () => {
    render(
      <ReleaseAdditionalInfoSection
        notes="Recorded at Stockholm Sound Studio."
        identifiers={[]}
      />,
    );

    expect(screen.getByText('Recorded at Stockholm Sound Studio.')).toBeInTheDocument();
  });

  it('renders identifiers when present', () => {
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
    expect(screen.getByText(/Matrix \/ Runout/)).toBeInTheDocument();
    expect(screen.getByText(/SK032-A/)).toBeInTheDocument();
    expect(screen.getByText(/Side A Runout/)).toBeInTheDocument();
  });

  it('renders community stats when present', () => {
    render(
      <ReleaseAdditionalInfoSection
        identifiers={[]}
        community={{ have: 214, want: 58, rating: { average: 4.3, count: 37 } }}
      />,
    );

    expect(screen.getByText(/214/)).toBeInTheDocument();
    expect(screen.getByText(/58/)).toBeInTheDocument();
    expect(screen.getByText(/4\.3/)).toBeInTheDocument();
    expect(screen.getByText(/37/)).toBeInTheDocument();
  });

  it('renders nothing when notes, identifiers, and community are all absent', () => {
    const { container } = render(<ReleaseAdditionalInfoSection identifiers={[]} />);

    expect(container).toBeEmptyDOMElement();
  });
});
