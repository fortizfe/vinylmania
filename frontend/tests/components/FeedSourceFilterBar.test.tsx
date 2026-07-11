import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { FeedSourceFilterBar } from '../../src/components/FeedSourceFilterBar';
import type { SourceStatus } from '../../src/services/feedsApi';

const sourceStatuses: SourceStatus[] = [
  { sourceId: 'metal-injection', sourceName: 'Metal Injection', status: 'ok', priority: true },
  { sourceId: 'metalsucks', sourceName: 'MetalSucks', status: 'ok', priority: true },
  { sourceId: 'louder-sound', sourceName: 'Louder Sound', status: 'ok', priority: true },
  {
    sourceId: 'metal-storm-news',
    sourceName: 'Metal Storm',
    status: 'ok',
    priority: false,
  },
  {
    sourceId: 'metal-storm-reviews',
    sourceName: 'Metal Storm',
    status: 'ok',
    priority: false,
  },
];

describe('FeedSourceFilterBar', () => {
  it('renders "All sources" plus one button per source', () => {
    render(
      <FeedSourceFilterBar
        sourceStatuses={sourceStatuses}
        selectedSource={null}
        onSelectSource={vi.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: 'All sources' })).toBeInTheDocument();
    expect(screen.getAllByRole('button')).toHaveLength(sourceStatuses.length + 1);
  });

  it('renders the three priority sources first, in the exact order Metal Injection → MetalSucks → Louder Sound, ahead of non-priority sources (spec FR-012)', () => {
    render(
      <FeedSourceFilterBar
        sourceStatuses={sourceStatuses}
        selectedSource={null}
        onSelectSource={vi.fn()}
      />,
    );

    const labels = screen.getAllByRole('button').map((button) => button.textContent);
    expect(labels).toEqual([
      'All sources',
      'Metal Injection',
      'MetalSucks',
      'Louder Sound',
      'Metal Storm',
      'Metal Storm',
    ]);
  });

  it('calls onSelectSource with the chosen sourceId when a source button is clicked', async () => {
    const onSelectSource = vi.fn();
    render(
      <FeedSourceFilterBar
        sourceStatuses={sourceStatuses}
        selectedSource={null}
        onSelectSource={onSelectSource}
      />,
    );

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Louder Sound' }));

    expect(onSelectSource).toHaveBeenCalledWith('louder-sound');
  });

  it('calls onSelectSource with null when "All sources" is clicked to clear the filter', async () => {
    const onSelectSource = vi.fn();
    render(
      <FeedSourceFilterBar
        sourceStatuses={sourceStatuses}
        selectedSource="louder-sound"
        onSelectSource={onSelectSource}
      />,
    );

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'All sources' }));

    expect(onSelectSource).toHaveBeenCalledWith(null);
  });

  it('marks the currently selected source as pressed', () => {
    render(
      <FeedSourceFilterBar
        sourceStatuses={sourceStatuses}
        selectedSource="metalsucks"
        onSelectSource={vi.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: 'MetalSucks' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByRole('button', { name: 'Metal Injection' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });

  it('gives every button a comfortable 44x44px minimum touch target (spec FR-006)', () => {
    render(
      <FeedSourceFilterBar
        sourceStatuses={sourceStatuses}
        selectedSource={null}
        onSelectSource={vi.fn()}
      />,
    );

    for (const button of screen.getAllByRole('button')) {
      expect(button).toHaveClass('min-h-11');
      expect(button).toHaveClass('min-w-11');
    }
  });

  it('every button is a native <button> reachable via Tab and activatable with Enter (spec FR-017)', async () => {
    const onSelectSource = vi.fn();
    render(
      <FeedSourceFilterBar
        sourceStatuses={sourceStatuses}
        selectedSource={null}
        onSelectSource={onSelectSource}
      />,
    );

    const button = screen.getByRole('button', { name: 'MetalSucks' });
    expect(button.tagName).toBe('BUTTON');

    button.focus();
    const user = userEvent.setup();
    await user.keyboard('{Enter}');

    expect(onSelectSource).toHaveBeenCalledWith('metalsucks');
  });
});
