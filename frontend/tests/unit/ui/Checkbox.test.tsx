import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { Checkbox } from '../../../src/components/ui/Checkbox';

describe('Checkbox', () => {
  it('associates the label with the control via id/htmlFor', () => {
    render(<Checkbox id="format-vinyl" label="Vinyl" checked={false} onChange={() => {}} />);

    const checkbox = screen.getByLabelText('Vinyl');
    expect(checkbox).toHaveAttribute('id', 'format-vinyl');
    expect(checkbox).toHaveAttribute('type', 'checkbox');
  });

  it('reflects the checked prop', () => {
    render(<Checkbox id="format-cd" label="CD" checked={true} onChange={() => {}} />);

    expect(screen.getByLabelText('CD')).toBeChecked();
  });

  it('calls onChange when clicked', async () => {
    const user = userEvent.setup();
    const handleChange = vi.fn();
    render(<Checkbox id="format-cassette" label="Cassette" checked={false} onChange={handleChange} />);

    await user.click(screen.getByLabelText('Cassette'));

    expect(handleChange).toHaveBeenCalledTimes(1);
  });
});
