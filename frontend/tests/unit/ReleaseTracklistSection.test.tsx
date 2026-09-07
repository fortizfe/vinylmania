import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { ReleaseTracklistSection } from '../../src/components/ReleaseTracklistSection';
import type { Track } from '../../src/services/libraryApi';

const tracklist: Track[] = [
  { position: 'A', title: 'Östermalm', duration: '4:45' },
  { position: 'B', title: 'Södermalm' },
];

describe('ReleaseTracklistSection', () => {
  it('renders each track position, title, and duration when present', () => {
    render(<ReleaseTracklistSection tracklist={tracklist} />);

    // <h2> so it sits under the page <h1> with the other detail cards
    // (feature 063 §C7, no skipped level).
    expect(
      screen.getByRole('heading', { level: 2, name: 'Tracklist' }),
    ).toBeInTheDocument();
    expect(screen.getByText(/A\. Östermalm \(4:45\)/)).toBeInTheDocument();
    expect(screen.getByText(/B\. Södermalm/)).toBeInTheDocument();
  });

  it('renders nothing when the tracklist is empty', () => {
    const { container } = render(<ReleaseTracklistSection tracklist={[]} />);

    expect(container).toBeEmptyDOMElement();
  });
});
