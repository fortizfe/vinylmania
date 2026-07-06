import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { StarRating } from '../../src/components/ui/StarRating';

describe('StarRating', () => {
  it('renders five stars with the current value pressed', () => {
    render(<StarRating value={3} onChange={vi.fn()} />);

    const group = screen.getByRole('group', { name: /rating/i });
    const stars = screen.getAllByRole('button');
    expect(group).toBeInTheDocument();
    expect(stars).toHaveLength(5);
    expect(stars[2]).toHaveAttribute('aria-pressed', 'true');
    expect(stars[3]).toHaveAttribute('aria-pressed', 'false');
  });

  it('reports the tapped star value', async () => {
    const onChange = vi.fn();
    render(<StarRating value={0} onChange={onChange} />);

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /4 stars/i }));

    expect(onChange).toHaveBeenCalledWith(4);
  });

  it('clears the rating when the current value is tapped again', async () => {
    const onChange = vi.fn();
    render(<StarRating value={4} onChange={onChange} />);

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /4 stars/i }));

    expect(onChange).toHaveBeenCalledWith(0);
  });

  it('is keyboard operable (Enter on a focused star)', async () => {
    const onChange = vi.fn();
    render(<StarRating value={0} onChange={onChange} />);

    const user = userEvent.setup();
    screen.getByRole('button', { name: /2 stars/i }).focus();
    await user.keyboard('{Enter}');

    expect(onChange).toHaveBeenCalledWith(2);
  });

  it('does not react when disabled', async () => {
    const onChange = vi.fn();
    render(<StarRating value={2} onChange={onChange} disabled />);

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /5 stars/i }));

    expect(onChange).not.toHaveBeenCalled();
  });
});
