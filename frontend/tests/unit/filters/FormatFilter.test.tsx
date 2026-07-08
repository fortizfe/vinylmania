import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { FormatFilter } from '../../../src/components/filters/FormatFilter';

describe('FormatFilter (feature 023, US1)', () => {
  it('shows the neutral "Format" label when no value is selected (FR-003)', () => {
    render(<FormatFilter value={[]} onChange={vi.fn()} />);

    expect(screen.getByRole('button', { name: /^format$/i })).toBeInTheDocument();
  });

  it('shows the single selected value as the label (FR-004)', () => {
    render(<FormatFilter value={['Vinyl']} onChange={vi.fn()} />);

    expect(screen.getByRole('button', { name: /^vinyl$/i })).toBeInTheDocument();
  });

  it('shows a comma-separated list, in selection order, when it fits (FR-005)', () => {
    render(<FormatFilter value={['Vinyl', 'CD']} onChange={vi.fn()} />);

    expect(screen.getByRole('button', { name: /^vinyl, cd$/i })).toBeInTheDocument();
  });

  it('falls back to "first (+N)" once the comma-separated list no longer fits (FR-006)', () => {
    render(
      <FormatFilter
        value={['Vinyl', 'CD', 'Cassette', 'Reel-To-Reel', 'Betacam SP']}
        onChange={vi.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: /^vinyl \(\+4\)$/i })).toBeInTheDocument();
  });

  it('switches back to the full list once deselecting brings the selection back under the fit threshold (FR-007)', () => {
    const { rerender } = render(
      <FormatFilter
        value={['Vinyl', 'CD', 'Cassette', 'Reel-To-Reel', 'Betacam SP']}
        onChange={vi.fn()}
      />,
    );
    expect(screen.getByRole('button', { name: /^vinyl \(\+4\)$/i })).toBeInTheDocument();

    rerender(<FormatFilter value={['Vinyl', 'CD']} onChange={vi.fn()} />);
    expect(screen.getByRole('button', { name: /^vinyl, cd$/i })).toBeInTheDocument();
  });

  it('calls onChange with the toggled option when the modal is used, without needing an external Apply action (FR-002)', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<FormatFilter value={['Vinyl']} onChange={onChange} />);

    await user.click(screen.getByRole('button', { name: /^vinyl$/i }));
    const dialog = screen.getByRole('dialog');
    await user.click(within(dialog).getByLabelText('CD'));

    expect(onChange).toHaveBeenCalledWith(['Vinyl', 'CD']);
  });
});
