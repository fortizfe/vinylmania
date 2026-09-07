import type { ComponentProps } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { presentRating } from '../../lib/releaseRating';
import { RatingCard } from './RatingCard';

/**
 * Feature 063 · contracts/ui-contracts.md §C4. The community half + read-only
 * personal state are US1; the editable personal half (`personal` present) is
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
    expect(
      screen.getByRole('status', { name: /rating 4\.3 out of 5/i }),
    ).toBeInTheDocument();
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

    expect(
      screen.getByRole('status', { name: /rating not available/i }),
    ).toBeInTheDocument();
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
    expect(
      screen.queryByRole('group', { name: /tu valoraci[oó]n/i }),
    ).not.toBeInTheDocument();
  });

  it('still renders the card with its heading when both halves are empty (search + unrated)', () => {
    render(
      <RatingCard
        community={communityModel({ presentation: presentRating(null), count: 0 })}
      />,
    );

    expect(
      screen.getByRole('heading', { level: 2, name: /valoraci[oó]n/i }),
    ).toBeInTheDocument();
    expect(screen.getByTestId('record-detail-rating-card')).toBeInTheDocument();
  });
});

function personalModel(
  overrides: Partial<NonNullable<Props['personal']>> = {},
): NonNullable<Props['personal']> {
  return {
    value: 3,
    onSave: vi.fn().mockResolvedValue(undefined),
    saving: false,
    ...overrides,
  };
}

describe('RatingCard (personal half — feature 063 US2)', () => {
  it('renders an editable star control named "Tu valoración" reflecting the current value', () => {
    renderCard({ personal: personalModel({ value: 3 }) });

    const group = screen.getByRole('group', { name: /tu valoraci[oó]n/i });
    expect(group).toBeInTheDocument();
    expect(screen.queryByText(/sin valorar/i)).not.toBeInTheDocument();

    const stars = screen.getAllByRole('button', { name: /stars/i });
    expect(stars).toHaveLength(5);
    expect(stars[2]).toHaveAttribute('aria-pressed', 'true');
    expect(stars[3]).toHaveAttribute('aria-pressed', 'false');
  });

  it('calls personal.onSave with the chosen rating when a star is activated', async () => {
    const personal = personalModel({ value: 3 });
    renderCard({ personal });

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /4 stars/i }));

    expect(personal.onSave).toHaveBeenCalledWith(4);
  });

  it('renders an editable star control (not the read-only "Sin valorar" text) when value is 0', () => {
    renderCard({ personal: personalModel({ value: 0 }) });

    expect(screen.getByRole('group', { name: /tu valoraci[oó]n/i })).toBeInTheDocument();
    expect(screen.queryByText(/sin valorar/i)).not.toBeInTheDocument();

    const stars = screen.getAllByRole('button', { name: /stars/i });
    stars.forEach((star) => expect(star).toHaveAttribute('aria-pressed', 'false'));
  });

  it('disables the star control while personal.saving is true', () => {
    renderCard({ personal: personalModel({ saving: true }) });

    screen
      .getAllByRole('button', { name: /stars/i })
      .forEach((star) => expect(star).toBeDisabled());
  });

  it('surfaces a retryable alert when personal.onSave rejects and retries the last value', async () => {
    const onSave = vi
      .fn()
      .mockRejectedValueOnce(new Error('network'))
      .mockResolvedValueOnce(undefined);
    renderCard({ personal: personalModel({ value: 2, onSave }) });

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /5 stars/i }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(/no se pudo guardar tu valoraci[oó]n\./i);

    await user.click(screen.getByRole('button', { name: /reintentar/i }));

    expect(onSave).toHaveBeenCalledTimes(2);
    expect(onSave).toHaveBeenLastCalledWith(5);
  });

  it('gives the "Reintentar" button the shared press + focus tokens, not a bespoke style (T041)', async () => {
    const onSave = vi.fn().mockRejectedValue(new Error('network'));
    renderCard({ personal: personalModel({ value: 2, onSave }) });

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /5 stars/i }));

    const retry = await screen.findByRole('button', { name: /reintentar/i });
    // `pressable` → an `:active` scale with a reduced-motion guard; `focusRing`
    // → the shared visible focus indicator.
    expect(retry.className).toMatch(/active:scale-\[0\.97\]/);
    expect(retry.className).toMatch(/motion-reduce:active:scale-100/);
    expect(retry.className).toMatch(/focus-visible:ring/);
  });
});

describe('RatingCard — layout stability (feature 063 §C4 / SC-008 / T043)', () => {
  const RESERVE = '[class*="min-h-[7.5rem]"]';

  it('reserves the same min-height in the empty (search) state', () => {
    const { container } = renderCard();
    expect(container.querySelector(RESERVE)).not.toBeNull();
  });

  it('reserves the same min-height with an editable personal rating', () => {
    const { container } = renderCard({ personal: personalModel({ value: 4 }) });
    expect(container.querySelector(RESERVE)).not.toBeNull();
  });

  it('reserves the same min-height in the save-error state (no jump when the alert appears)', async () => {
    const onSave = vi.fn().mockRejectedValue(new Error('network'));
    const { container } = renderCard({ personal: personalModel({ value: 2, onSave }) });

    await userEvent.setup().click(screen.getByRole('button', { name: /3 stars/i }));
    await screen.findByRole('alert');

    expect(container.querySelector(RESERVE)).not.toBeNull();
  });
});
