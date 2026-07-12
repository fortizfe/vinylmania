import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { StarRating } from '../../../src/components/ui/StarRating';

describe('StarRating', () => {
  it('renders five star buttons reflecting the current value', () => {
    render(<StarRating value={3} onChange={() => {}} />);

    const stars = screen.getAllByRole('button');
    expect(stars).toHaveLength(5);
    expect(stars[2]).toHaveAttribute('aria-pressed', 'true');
    expect(stars[3]).toHaveAttribute('aria-pressed', 'false');
  });

  it('calls onChange with the clicked star value', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<StarRating value={0} onChange={onChange} />);

    await user.click(screen.getByRole('button', { name: '4 stars' }));

    expect(onChange).toHaveBeenCalledWith(4);
  });

  it('clears the rating when the currently-active star is tapped again', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<StarRating value={3} onChange={onChange} />);

    await user.click(screen.getByRole('button', { name: '3 stars' }));

    expect(onChange).toHaveBeenCalledWith(0);
  });

  it('each star meets the 44x44px minimum touch target (FR-004)', () => {
    render(<StarRating value={0} onChange={() => {}} />);

    for (const star of screen.getAllByRole('button')) {
      expect(star.className).toMatch(/min-h-11/);
      expect(star.className).toMatch(/min-w-11/);
    }
  });
});
