import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { ResultCardActions } from '../../src/components/ResultCardActions';

describe('ResultCardActions', () => {
  it('renders both actions in the same position', () => {
    render(
      <ResultCardActions onAdd={() => {}} onPreview={() => {}} adding={false} added={false} />,
    );

    expect(screen.getByRole('button', { name: /add to library/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /preview details/i })).toBeInTheDocument();
  });

  it('calls onAdd and onPreview when activated', async () => {
    const user = userEvent.setup();
    const onAdd = vi.fn();
    const onPreview = vi.fn();
    render(<ResultCardActions onAdd={onAdd} onPreview={onPreview} adding={false} added={false} />);

    await user.click(screen.getByRole('button', { name: /add to library/i }));
    await user.click(screen.getByRole('button', { name: /preview details/i }));

    expect(onAdd).toHaveBeenCalledTimes(1);
    expect(onPreview).toHaveBeenCalledTimes(1);
  });

  it('shows a busy state on the add action while adding, and stays disabled', () => {
    render(<ResultCardActions onAdd={() => {}} onPreview={() => {}} adding added={false} />);

    const addButton = screen.getByRole('button', { name: /add to library/i });
    expect(addButton).toBeDisabled();
    expect(addButton).toHaveAttribute('aria-busy', 'true');
  });

  it('shows an added confirmation once added, and the preview action stays clickable', async () => {
    const user = userEvent.setup();
    const onPreview = vi.fn();
    render(<ResultCardActions onAdd={() => {}} onPreview={onPreview} adding={false} added />);

    expect(screen.getByRole('button', { name: /added to library/i })).toBeDisabled();

    await user.click(screen.getByRole('button', { name: /preview details/i }));
    expect(onPreview).toHaveBeenCalledTimes(1);
  });
});
