import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import { DiscogsRelinkNotice } from '../../src/components/DiscogsRelinkNotice';
import { FeedSourceStatusBanner } from '../../src/components/FeedSourceStatusBanner';
import { LibraryLinkRequired } from '../../src/components/LibraryLinkRequired';
import { UnderConstruction } from '../../src/components/UnderConstruction';

/**
 * Spec 059 US5 T086 — status / empty-state components get one gentle
 * opacity-only entrance (`status-fade-in`: `--motion-duration-fade`,
 * `--ease-out`, NO translate/scale). Movement would pull the eye away from
 * the wayfinding copy these components exist to deliver. The global
 * `prefers-reduced-motion` guard collapses the timing to instant.
 */
describe('status-message entrance (US5 / T086)', () => {
  it('UnderConstruction fades its card in and keeps clear "check back" wayfinding', () => {
    render(<UnderConstruction title="Dashboard" />);

    expect(screen.getByText(/under construction/i).closest('div')).toHaveClass(
      'status-fade-in',
    );
    expect(screen.getByText(/check back soon/i)).toBeInTheDocument();
  });

  it('LibraryLinkRequired fades in and points the user to a way out', () => {
    render(
      <MemoryRouter>
        <LibraryLinkRequired variant="not-linked" />
      </MemoryRouter>,
    );

    const card = screen.getByRole('heading').closest('div');
    expect(card).toHaveClass('status-fade-in');
    expect(screen.getByRole('link', { name: /go to your profile/i })).toHaveAttribute(
      'href',
      '/app/profile',
    );
  });

  it('DiscogsRelinkNotice fades in', () => {
    render(
      <MemoryRouter>
        <DiscogsRelinkNotice />
      </MemoryRouter>,
    );

    expect(screen.getByText(/no longer valid/i).closest('div')).toHaveClass(
      'status-fade-in',
    );
  });

  it('FeedSourceStatusBanner fades its status role in', () => {
    render(
      <FeedSourceStatusBanner
        sourceStatuses={[{ sourceId: 's1', sourceName: 'Loudwire', status: 'unavailable' }]}
      />,
    );

    expect(screen.getByRole('status')).toHaveClass('status-fade-in');
  });
});
