import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { ResultCardActions } from '../../src/components/ResultCardActions';

describe('ResultCardActions', () => {
  it('renders the add action', () => {
    render(<ResultCardActions onAdd={() => {}} adding={false} added={false} />);

    expect(screen.getByRole('button', { name: /add to library/i })).toBeInTheDocument();
  });

  it('calls onAdd when activated', async () => {
    const user = userEvent.setup();
    const onAdd = vi.fn();
    render(<ResultCardActions onAdd={onAdd} adding={false} added={false} />);

    await user.click(screen.getByRole('button', { name: /add to library/i }));

    expect(onAdd).toHaveBeenCalledTimes(1);
  });

  it('shows a busy state on the add action while adding, and stays disabled', () => {
    render(<ResultCardActions onAdd={() => {}} adding added={false} />);

    const addButton = screen.getByRole('button', { name: /add to library/i });
    expect(addButton).toBeDisabled();
    expect(addButton).toHaveAttribute('aria-busy', 'true');
  });

  it('shows an added confirmation once added', () => {
    render(<ResultCardActions onAdd={() => {}} adding={false} added />);

    expect(screen.getByRole('button', { name: /added to library/i })).toBeDisabled();
  });
});
