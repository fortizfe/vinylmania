import type { ComponentProps } from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { presentRating } from '../../lib/releaseRating';
import { RatingCard } from './RatingCard';

/**
 * Feature 063 · contracts/ui-contracts.md §C4 — community half only for this
 * phase (US1). The personal-editing half (`personal` present) is covered by
 * US2 T021.
 */

type Props = ComponentProps<typeof RatingCard>;

function communityModel(overrides: Partial<Props['community']> = {}): Props['community'] {
  return {
    presentation: presentRating({ average: 4.3, count: 37 }),
    count: 37,
    have: null,
    want: null,
    ...overrides,
  };
}

function renderCard(overrides: Partial<Props> = {}) {
  return render(<RatingCard community={communityModel()} {...overrides} />);
}

describe('RatingCard (community half — feature 063 US1)', () => {
  it('always renders inside a section with a single <h2> heading', () => {
    renderCard();

    const heading = screen.getByRole('heading', { level: 2, name: /valoraci[oó]n/i });
    expect(heading).toBeInTheDocument();
    expect(screen.getByTestId('record-detail-rating-card')).toBeInTheDocument();
  });

  it('shows the community rating badge value and the vote count when the rating is valid', () => {
    renderCard({
      community: communityModel({
        presentation: presentRating({ average: 4.3, count: 812 }),
        count: 812,
      }),
    });

    // ReleaseRatingBadge exposes the value through its role="status" label.
    expect(screen.getByRole('status', { name: /rating 4\.3 out of 5/i })).toBeInTheDocument();
    expect(screen.getByText(/\(812\)/)).toBeInTheDocument();
    expect(screen.queryByText(/sin valoraciones/i)).not.toBeInTheDocument();
  });

  it('shows the unrated placeholder and "Sin valoraciones" with no count when the band is unrated', () => {
    renderCard({
      community: communityModel({
        presentation: presentRating(null),
        count: 0,
      }),
    });

    expect(screen.getByRole('status', { name: /rating not available/i })).toBeInTheDocument();
    expect(screen.getByText(/sin valoraciones/i)).toBeInTheDocument();
    expect(screen.queryByText(/\(0\)/)).not.toBeInTheDocument();
  });

  it('renders both the "lo tienen" and "lo quieren" lines when have and want are set', () => {
    renderCard({ community: communityModel({ have: 1200, want: 340 }) });

    expect(screen.getByText(/1200 lo tienen/i)).toBeInTheDocument();
    expect(screen.getByText(/340 lo quieren/i)).toBeInTheDocument();
  });

  it('omits the "lo tienen" line when have is null', () => {
    renderCard({ community: communityModel({ have: null, want: 340 }) });

    expect(screen.queryByText(/lo tienen/i)).not.toBeInTheDocument();
    expect(screen.getByText(/340 lo quieren/i)).toBeInTheDocument();
  });

  it('renders a read-only "Sin valorar" personal state — no interactive star control — when personal is omitted', () => {
    renderCard();

    expect(screen.getByText(/tu valoraci[oó]n/i)).toBeInTheDocument();
    expect(screen.getByText(/sin valorar/i)).toBeInTheDocument();
    expect(screen.queryByRole('slider')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /stars/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('group', { name: /tu valoraci[oó]n/i })).not.toBeInTheDocument();
  });

  it('still renders the card with its heading when both halves are empty (search + unrated)', () => {
    render(
      <RatingCard
        community={communityModel({ presentation: presentRating(null), count: 0 })}
      />,
    );

    expect(screen.getByRole('heading', { level: 2, name: /valoraci[oó]n/i })).toBeInTheDocument();
    expect(screen.getByTestId('record-detail-rating-card')).toBeInTheDocument();
  });
});
