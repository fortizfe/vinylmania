import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { Input } from '../../../src/components/ui/Input';

describe('Input', () => {
  it('associates the label with the control via id/htmlFor', () => {
    render(<Input id="record-search" label="Search Discogs" value="" onChange={() => {}} />);

    const input = screen.getByLabelText('Search Discogs');
    expect(input).toHaveAttribute('id', 'record-search');
  });

  it('forwards standard input props such as onChange', async () => {
    const user = userEvent.setup();
    const handleChange = vi.fn();
    render(<Input id="notes" label="Notes" value="" onChange={handleChange} />);

    await user.type(screen.getByLabelText('Notes'), 'a');

    expect(handleChange).toHaveBeenCalled();
  });
});
