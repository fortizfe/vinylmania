import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { TextFilterField } from '../../../src/components/filters/TextFilterField';

describe('TextFilterField (feature 023, US2)', () => {
  it('renders the given label and value', () => {
    render(
      <TextFilterField id="filter-genre" label="Genre" value="Rock" onChange={vi.fn()} />,
    );

    expect(screen.getByLabelText(/^genre$/i)).toHaveValue('Rock');
  });

  it('calls onChange with the new text as the user types', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(
      <TextFilterField id="filter-style" label="Style" value="" onChange={onChange} />,
    );

    await user.type(screen.getByLabelText(/^style$/i), 'X');

    expect(onChange).toHaveBeenCalledWith('X');
  });

  it('renders at a compact width, smaller than the pre-feature 023 flex-1 sizing (FR-008)', () => {
    render(
      <TextFilterField id="filter-genre" label="Genre" value="" onChange={vi.fn()} />,
    );

    const wrapper = screen.getByLabelText(/^genre$/i).closest('div')?.parentElement;
    expect(wrapper?.className).not.toMatch(/flex-1/);
    expect(wrapper?.className).toMatch(/w-28/);
  });
});
