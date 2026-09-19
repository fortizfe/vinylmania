import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { FeedSourceFilterBar } from '../../src/components/FeedSourceFilterBar';
import type { SourceStatus } from '../../src/services/feedsApi';

const sourceStatuses: SourceStatus[] = [
  {
    sourceId: 'metal-injection',
    sourceName: 'Metal Injection',
    status: 'ok',
    priority: true,
  },
  { sourceId: 'metalsucks', sourceName: 'MetalSucks', status: 'ok', priority: true },
  { sourceId: 'louder-sound', sourceName: 'Louder Sound', status: 'ok', priority: true },
  {
    sourceId: 'sample-source-1',
    sourceName: 'Sample Source',
    status: 'ok',
    priority: false,
  },
  {
    sourceId: 'sample-source-2',
    sourceName: 'Sample Source',
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
      'Sample Source',
      'Sample Source',
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
  it('scrolls a partly hidden chip fully into the chip row, focus ring included, when it gets focus (spec 067 T050 #5, WCAG 2.4.11)', () => {
    render(
      <FeedSourceFilterBar
        sourceStatuses={sourceStatuses}
        selectedSource={null}
        onSelectSource={vi.fn()}
      />,
    );

    // Chrome leaves a partly visible element where it is on Tab focus, so the
    // row scrolls it clear itself: 16 px of room past each edge.
    const row = screen.getByRole('group', { name: 'Filter by source' });
    let scrollLeft = 0;
    Object.defineProperty(row, 'scrollLeft', {
      get: () => scrollLeft,
      set: (value: number) => (scrollLeft = value),
    });
    const rect = (left: number, right: number) => ({ left, right }) as DOMRect;
    row.getBoundingClientRect = () => rect(0, 320);

    const clippedRight = screen.getByRole('button', { name: 'MetalSucks' });
    clippedRight.getBoundingClientRect = () => rect(280, 380);
    clippedRight.focus();
    expect(scrollLeft).toBe(380 - (320 - 16));

    const clippedLeft = screen.getByRole('button', { name: 'Metal Injection' });
    clippedLeft.getBoundingClientRect = () => rect(-30, 90);
    clippedLeft.focus();
    expect(scrollLeft).toBe(76 - (16 + 30));

    const inside = screen.getByRole('button', { name: 'Louder Sound' });
    inside.getBoundingClientRect = () => rect(100, 200);
    inside.focus();
    expect(scrollLeft, 'a chip already in view does not move the row').toBe(30);
  });

  it('keeps the pill outline and the selected state distinct under forced colours, not by colour fill alone (spec 067 T050 #4, FR-016)', () => {
    render(
      <FeedSourceFilterBar
        sourceStatuses={sourceStatuses}
        selectedSource="metalsucks"
        onSelectSource={vi.fn()}
      />,
    );

    // A transparent border is invisible normally; forced colours paint it.
    for (const button of screen.getAllByRole('button')) {
      expect(button).toHaveClass('border', 'border-transparent');
    }
    // `bg-primary` is dropped under forced colours; system colours are kept.
    const selected = screen.getByRole('button', { name: 'MetalSucks' });
    expect(selected).toHaveAttribute('aria-pressed', 'true');
    expect(selected).toHaveClass(
      'forced-colors:aria-pressed:bg-[Highlight]',
      'forced-colors:aria-pressed:text-[HighlightText]',
    );
  });

  describe('unavailable source chip (feature 067 US4, FR-015, D12)', () => {
    const withUnavailable: SourceStatus[] = [
      {
        sourceId: 'sample-source-1',
        sourceName: 'Sample Source',
        status: 'ok',
        priority: false,
      },
      {
        sourceId: 'loudwire',
        sourceName: 'Loudwire',
        status: 'unavailable',
        priority: false,
      },
      { sourceId: 'metalsucks', sourceName: 'MetalSucks', status: 'ok', priority: true },
      {
        sourceId: 'metal-injection',
        sourceName: 'Metal Injection',
        status: 'unavailable',
        priority: true,
      },
    ];

    it('renders visible "unavailable" text and a decorative aria-hidden SVG on the unavailable chip (never colour alone)', () => {
      render(
        <FeedSourceFilterBar
          sourceStatuses={withUnavailable}
          selectedSource={null}
          onSelectSource={vi.fn()}
        />,
      );

      const chip = screen.getByRole('button', { name: /Loudwire/ });
      expect(within(chip).getByText(/unavailable/i)).toBeVisible();
      const svg = chip.querySelector('svg');
      expect(svg).not.toBeNull();
      expect(svg).toHaveAttribute('aria-hidden', 'true');
    });

    it('includes "unavailable" in the chip button\'s accessible name', () => {
      render(
        <FeedSourceFilterBar
          sourceStatuses={withUnavailable}
          selectedSource={null}
          onSelectSource={vi.fn()}
        />,
      );

      expect(
        screen.getByRole('button', { name: /^Loudwire\s+unavailable$/i }),
      ).toBeInTheDocument();
    });

    it('names the chip "<name> unavailable" without relying on a whitespace-only text node, which Chrome drops (spec 067 T050 #3, WCAG 4.1.2 / 2.5.3)', () => {
      render(
        <FeedSourceFilterBar
          sourceStatuses={withUnavailable}
          selectedSource={null}
          onSelectSource={vi.fn()}
        />,
      );

      const chip = screen.getByRole('button', { name: /^Loudwire/ });
      expect(chip).toHaveAttribute('aria-label', 'Loudwire unavailable');
      // Label-in-name: the visible text reads the same words in the same order.
      expect(chip.textContent?.replace(/\s+/g, ' ')).toBe('Loudwire unavailable');
    });

    it('stays a native <button> that calls onSelectSource and toggles aria-pressed (US3 scenario 3)', async () => {
      const onSelectSource = vi.fn();
      const { rerender } = render(
        <FeedSourceFilterBar
          sourceStatuses={withUnavailable}
          selectedSource={null}
          onSelectSource={onSelectSource}
        />,
      );

      const chip = screen.getByRole('button', { name: /Loudwire/ });
      expect(chip.tagName).toBe('BUTTON');
      expect(chip).toHaveAttribute('aria-pressed', 'false');

      await userEvent.setup().click(chip);
      expect(onSelectSource).toHaveBeenCalledWith('loudwire');

      rerender(
        <FeedSourceFilterBar
          sourceStatuses={withUnavailable}
          selectedSource="loudwire"
          onSelectSource={onSelectSource}
        />,
      );
      expect(screen.getByRole('button', { name: /Loudwire/ })).toHaveAttribute(
        'aria-pressed',
        'true',
      );
    });

    it('shows no marker on ok sources', () => {
      render(
        <FeedSourceFilterBar
          sourceStatuses={withUnavailable}
          selectedSource={null}
          onSelectSource={vi.fn()}
        />,
      );

      for (const name of ['All sources', 'MetalSucks', 'Sample Source']) {
        const chip = screen.getByRole('button', { name });
        expect(chip).not.toHaveTextContent(/unavailable/i);
        expect(chip.querySelector('svg')).toBeNull();
      }
    });

    it('still orders priority sources first, whatever their status', () => {
      render(
        <FeedSourceFilterBar
          sourceStatuses={withUnavailable}
          selectedSource={null}
          onSelectSource={vi.fn()}
        />,
      );

      const labels = screen.getAllByRole('button').map((button) => button.textContent);
      expect(labels[0]).toBe('All sources');
      expect(labels[1]).toMatch(/^MetalSucks$/);
      expect(labels[2]).toMatch(/^Metal Injection\s*unavailable$/i);
      expect(labels[3]).toBe('Sample Source');
      expect(labels[4]).toMatch(/^Loudwire\s*unavailable$/i);
    });
  });
});
