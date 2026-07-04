import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { TracklistCard } from '../../src/components/TracklistCard';

describe('TracklistCard', () => {
  it('shows a message when there are no tracks', () => {
    render(<TracklistCard tracks={[]} />);

    expect(screen.getByText(/no tracklist available/i)).toBeInTheDocument();
  });

  it('renders each track position, title, and duration', () => {
    render(
      <TracklistCard
        tracks={[
          { position: 'A', title: 'Östermalm', duration: '4:45' },
          { position: 'B', title: 'Södermalm' },
        ]}
      />,
    );

    expect(screen.getByText(/Östermalm/)).toBeInTheDocument();
    expect(screen.getByText(/4:45/)).toBeInTheDocument();
    expect(screen.getByText(/Södermalm/)).toBeInTheDocument();
    expect(screen.queryByText(/no tracklist available/i)).not.toBeInTheDocument();
  });
});
