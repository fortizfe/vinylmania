import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { MyCopySection } from '../../src/components/MyCopySection';

describe('MyCopySection', () => {
  it('renders condition and notes read-mode text when present', () => {
    render(
      <MyCopySection
        condition="Near Mint"
        notes="Bought at a record fair"
        onSaveCondition={vi.fn()}
        onSaveNotes={vi.fn()}
        onRemove={vi.fn()}
      />,
    );

    expect(screen.getByText('Near Mint')).toBeInTheDocument();
    expect(screen.getByText('Bought at a record fair')).toBeInTheDocument();
  });

  it('shows placeholders when condition and notes are absent', () => {
    render(
      <MyCopySection
        onSaveCondition={vi.fn()}
        onSaveNotes={vi.fn()}
        onRemove={vi.fn()}
      />,
    );

    expect(screen.getByText('Add a condition')).toBeInTheDocument();
    expect(screen.getByText('Add notes')).toBeInTheDocument();
  });

  it('edits condition via a fixed-option select and calls onSaveCondition on blur', async () => {
    const onSaveCondition = vi.fn().mockResolvedValue(undefined);
    render(
      <MyCopySection
        condition="Good"
        notes=""
        onSaveCondition={onSaveCondition}
        onSaveNotes={vi.fn()}
        onRemove={vi.fn()}
      />,
    );

    const user = userEvent.setup();
    await user.click(screen.getByText('Good'));
    const select = screen.getByLabelText('Condition');
    expect(select.tagName).toBe('SELECT');
    await user.selectOptions(select, 'Mint');
    await act(async () => {
      select.blur();
    });

    expect(onSaveCondition).toHaveBeenCalledWith('Mint');
  });

  it('edits notes via a textarea and discards the change on Escape without saving', async () => {
    const onSaveNotes = vi.fn();
    render(
      <MyCopySection
        condition=""
        notes="Original notes"
        onSaveCondition={vi.fn()}
        onSaveNotes={onSaveNotes}
        onRemove={vi.fn()}
      />,
    );

    const user = userEvent.setup();
    await user.click(screen.getByText('Original notes'));
    const textarea = screen.getByLabelText('Notes');
    expect(textarea.tagName).toBe('TEXTAREA');
    await user.clear(textarea);
    await user.type(textarea, 'Discarded edit');
    await user.keyboard('{Escape}');

    expect(onSaveNotes).not.toHaveBeenCalled();
    expect(screen.getByText('Original notes')).toBeInTheDocument();
  });

  it('calls onRemove when "Remove from library" is clicked', async () => {
    const onRemove = vi.fn();
    render(
      <MyCopySection
        onSaveCondition={vi.fn()}
        onSaveNotes={vi.fn()}
        onRemove={onRemove}
      />,
    );

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /remove from library/i }));

    expect(onRemove).toHaveBeenCalled();
  });
});
