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

  it('renders without throwing when identifiers is undefined (spec 036, Cluster C hardening)', () => {
    // TypeScript declares `identifiers` as required, but an incomplete API
    // response (or a stale test fixture, per spec 036 research.md §6) can
    // still deliver `undefined` at runtime — this must not crash the render.
    const props = { notes: 'Some notes' } as unknown as Parameters<
      typeof ReleaseAdditionalInfoSection
    >[0];

    expect(() => render(<ReleaseAdditionalInfoSection {...props} />)).not.toThrow();
    expect(screen.getByText('Some notes')).toBeInTheDocument();
  });
});
