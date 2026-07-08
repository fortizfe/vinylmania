import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createRef } from 'react';
import { describe, expect, it, vi } from 'vitest';

import {
  InlineEditableField,
  type InlineEditableFieldHandle,
} from '../../../src/components/ui/InlineEditableField';

function renderTextEditor({
  value,
  onChange,
  onBlur,
  onKeyDown,
  autoFocus,
}: {
  value: string;
  onChange: (value: string) => void;
  onBlur: () => void;
  onKeyDown: (event: React.KeyboardEvent<HTMLElement>) => void;
  autoFocus: boolean;
}) {
  return (
    <input
      aria-label="Condition"
      value={value}
      onChange={(event) => onChange(event.target.value)}
      onBlur={onBlur}
      onKeyDown={onKeyDown}
      autoFocus={autoFocus}
    />
  );
}

describe('InlineEditableField', () => {
  it('renders the value as plain text in read mode', () => {
    render(
      <InlineEditableField
        value="Near Mint"
        placeholder="Add a condition"
        fieldLabel="Condition"
        renderEditor={renderTextEditor}
        onSave={vi.fn()}
      />,
    );

    expect(screen.getByText('Near Mint')).toBeInTheDocument();
    expect(screen.queryByLabelText('Condition')).not.toBeInTheDocument();
  });

  it('shows the placeholder when the value is empty', () => {
    render(
      <InlineEditableField
        value=""
        placeholder="Add a condition"
        fieldLabel="Condition"
        renderEditor={renderTextEditor}
        onSave={vi.fn()}
      />,
    );

    expect(screen.getByText('Add a condition')).toBeInTheDocument();
  });

  it('switches to an editable control on click and calls onActivate', async () => {
    const onActivate = vi.fn();
    render(
      <InlineEditableField
        value="Near Mint"
        placeholder="Add a condition"
        fieldLabel="Condition"
        renderEditor={renderTextEditor}
        onSave={vi.fn()}
        onActivate={onActivate}
      />,
    );

    const user = userEvent.setup();
    await user.click(screen.getByText('Near Mint'));

    expect(screen.getByLabelText('Condition')).toBeInTheDocument();
    expect(onActivate).toHaveBeenCalledTimes(1);
  });

  it('saves the new value on blur and returns to read mode', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(
      <InlineEditableField
        value="Near Mint"
        placeholder="Add a condition"
        fieldLabel="Condition"
        renderEditor={renderTextEditor}
        onSave={onSave}
      />,
    );

    const user = userEvent.setup();
    await user.click(screen.getByText('Near Mint'));
    const input = screen.getByLabelText('Condition');
    await user.clear(input);
    await user.type(input, 'Mint');
    await act(async () => {
      input.blur();
    });

    await waitFor(() => expect(onSave).toHaveBeenCalledWith('Mint'));
    await waitFor(() => expect(screen.getByText('Mint')).toBeInTheDocument());
    expect(screen.queryByLabelText('Condition')).not.toBeInTheDocument();
  });

  it('does not call onSave when blurring without changing the value', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(
      <InlineEditableField
        value="Near Mint"
        placeholder="Add a condition"
        fieldLabel="Condition"
        renderEditor={renderTextEditor}
        onSave={onSave}
      />,
    );

    const user = userEvent.setup();
    await user.click(screen.getByText('Near Mint'));
    await act(async () => {
      screen.getByLabelText('Condition').blur();
    });

    await waitFor(() =>
      expect(screen.queryByLabelText('Condition')).not.toBeInTheDocument(),
    );
    expect(onSave).not.toHaveBeenCalled();
  });

  it('reverts to the previous value and does not save when Escape is pressed', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(
      <InlineEditableField
        value="Near Mint"
        placeholder="Add a condition"
        fieldLabel="Condition"
        renderEditor={renderTextEditor}
        onSave={onSave}
      />,
    );

    const user = userEvent.setup();
    await user.click(screen.getByText('Near Mint'));
    const input = screen.getByLabelText('Condition');
    await user.clear(input);
    await user.type(input, 'Poor');
    await user.keyboard('{Escape}');

    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByText('Near Mint')).toBeInTheDocument();
    expect(screen.queryByLabelText('Condition')).not.toBeInTheDocument();
  });

  it('keeps the field editable with the entered value and shows an error when saving fails', async () => {
    const onSave = vi.fn().mockRejectedValue(new Error('network error'));
    render(
      <InlineEditableField
        value="Near Mint"
        placeholder="Add a condition"
        fieldLabel="Condition"
        renderEditor={renderTextEditor}
        onSave={onSave}
      />,
    );

    const user = userEvent.setup();
    await user.click(screen.getByText('Near Mint'));
    const input = screen.getByLabelText('Condition');
    await user.clear(input);
    await user.type(input, 'Mint');
    await act(async () => {
      input.blur();
    });

    await waitFor(() => expect(screen.getByText(/couldn't save/i)).toBeInTheDocument());
    expect(screen.getByLabelText('Condition')).toHaveValue('Mint');
  });

  it('commits an in-progress edit via the imperative handle, e.g. when another field is activated', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    const ref = createRef<InlineEditableFieldHandle>();
    render(
      <InlineEditableField
        ref={ref}
        value="Near Mint"
        placeholder="Add a condition"
        fieldLabel="Condition"
        renderEditor={renderTextEditor}
        onSave={onSave}
      />,
    );

    const user = userEvent.setup();
    await user.click(screen.getByText('Near Mint'));
    const input = screen.getByLabelText('Condition');
    await user.clear(input);
    await user.type(input, 'Mint');

    await act(async () => {
      ref.current?.commit();
    });

    await waitFor(() => expect(onSave).toHaveBeenCalledWith('Mint'));
    expect(screen.queryByLabelText('Condition')).not.toBeInTheDocument();
  });
});
