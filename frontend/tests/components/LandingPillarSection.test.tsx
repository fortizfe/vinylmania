import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { LandingPillarSection } from '../../src/components/LandingPillarSection';

describe('LandingPillarSection', () => {
  it('renders an icon, a title, and a description', () => {
    render(
      <LandingPillarSection
        icon={<svg data-testid="pillar-icon" />}
        title="Your catalog, powered by Discogs"
        description="Every release backed by Discogs metadata."
      />,
    );

    expect(screen.getByTestId('pillar-icon')).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: /your catalog, powered by discogs/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/every release backed by discogs metadata/i),
    ).toBeInTheDocument();
  });
});
