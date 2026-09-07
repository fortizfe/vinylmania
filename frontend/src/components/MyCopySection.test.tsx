import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { MyCopySection } from './MyCopySection';
import type { EntryDiscogsData } from '../services/libraryApi';

const baseDiscogs: EntryDiscogsData = {
  instanceId: 100,
  folderId: 1,
  rating: 0,
  mediaCondition: null,
  sleeveCondition: null,
  notes: null,
  editable: { mediaCondition: true, sleeveCondition: true, notes: true },
};

function makeProps(overrides: Partial<EntryDiscogsData> = {}) {
  return {
    discogs: { ...baseDiscogs, ...overrides },
    onSaveMediaCondition: vi.fn().mockResolvedValue(undefined),
    onSaveSleeveCondition: vi.fn().mockResolvedValue(undefined),
    onSaveNotes: vi.fn().mockResolvedValue(undefined),
  };
}

describe('MyCopySection (trimmed — condition + notes only)', () => {
  it('renders no rating control (moved to the Rating card)', () => {
    render(<MyCopySection {...makeProps({ rating: 3 })} />);

    expect(
      screen.queryByRole('button', { name: /rating|valoraci/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('group', { name: /rating|valoraci/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('slider', { name: /rating|valoraci/i }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/rating|valoraci/i)).not.toBeInTheDocument();
  });

  it('renders no "Remove from library" button (moved to the action bar)', () => {
    render(<MyCopySection {...makeProps()} />);

    expect(
      screen.queryByRole('button', { name: /remove from library/i }),
    ).not.toBeInTheDocument();
  });

  it('calls onSaveMediaCondition when the media-condition select changes', async () => {
    const props = makeProps();
    render(<MyCopySection {...props} />);

    const user = userEvent.setup();
    await user.selectOptions(screen.getByLabelText('Media Condition'), 'Mint (M)');

    expect(props.onSaveMediaCondition).toHaveBeenCalledWith('Mint (M)');
  });

  it('calls onSaveSleeveCondition when the sleeve-condition select changes', async () => {
    const props = makeProps();
    render(<MyCopySection {...props} />);

    const user = userEvent.setup();
    await user.selectOptions(screen.getByLabelText('Sleeve Condition'), 'Generic');

    expect(props.onSaveSleeveCondition).toHaveBeenCalledWith('Generic');
  });

  it('calls onSaveNotes when the notes field is committed on blur', async () => {
    const props = makeProps();
    render(<MyCopySection {...props} />);

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /edit notes/i }));
    const textarea = screen.getByRole('textbox', { name: 'Notes' });
    await user.type(textarea, 'First pressing');
    await user.tab();

    expect(props.onSaveNotes).toHaveBeenCalledWith('First pressing');
  });

  it('shows the "not available on this collection" note and disables notes when editable.notes is false', async () => {
    render(
      <MyCopySection
        {...makeProps({
          editable: { mediaCondition: true, sleeveCondition: true, notes: false },
        })}
      />,
    );

    expect(
      screen.getByText(/Notes.*not available on this collection/i),
    ).toBeInTheDocument();

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /edit notes/i }));
    expect(
      screen.queryByRole('textbox', { name: 'Notes' }),
    ).not.toBeInTheDocument();
  });

  it('disables the condition selects when discogs is null', () => {
    render(
      <MyCopySection
        discogs={null}
        onSaveMediaCondition={vi.fn()}
        onSaveSleeveCondition={vi.fn()}
        onSaveNotes={vi.fn()}
      />,
    );

    expect(screen.getByLabelText('Media Condition')).toBeDisabled();
    expect(screen.getByLabelText('Sleeve Condition')).toBeDisabled();
  });
});
