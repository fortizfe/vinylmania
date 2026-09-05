import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { Input } from '../../../src/components/ui/Input';

describe('Input', () => {
  it('associates the label with the control via id/htmlFor', () => {
    render(
      <Input id="record-search" label="Search Discogs" value="" onChange={() => {}} />,
    );

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

  it('meets the 44px minimum touch target height (FR-004)', () => {
    render(
      <Input id="record-search" label="Search Discogs" value="" onChange={() => {}} />,
    );

    expect(screen.getByLabelText('Search Discogs').className).toMatch(/min-h-11/);
  });

  it('keeps the border-colour focus treatment and animates it on a motion token (spec 059 US5 T085)', () => {
    render(
      <Input id="record-search" label="Search Discogs" value="" onChange={() => {}} />,
    );

    const input = screen.getByLabelText('Search Discogs');
    expect(input.className).toMatch(/focus:border-primary/);
    // Only the border colour animates (no width change → no layout shift).
    expect(input.className).toMatch(/transition-\[border-color\]/);
    expect(input.className).toMatch(/duration-\(--motion-duration-fade\)/);
    expect(input.className).not.toMatch(/duration-\d/);
  });
});
