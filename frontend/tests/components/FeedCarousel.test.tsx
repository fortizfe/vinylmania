import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { FeedCarousel } from '../../src/components/FeedCarousel';

interface StubDimensions {
  scrollWidth: number;
  clientWidth: number;
  scrollLeft: number;
}

function stubTrackDimensions(
  track: HTMLElement,
  { scrollWidth, clientWidth, scrollLeft }: StubDimensions,
) {
  Object.defineProperty(track, 'scrollWidth', { value: scrollWidth, configurable: true });
  Object.defineProperty(track, 'clientWidth', { value: clientWidth, configurable: true });
  Object.defineProperty(track, 'scrollLeft', {
    value: scrollLeft,
    configurable: true,
    writable: true,
  });
}

function renderCarousel(itemCount = 3) {
  render(
    <FeedCarousel>
      {Array.from({ length: itemCount }).map((_, index) => (
        <div key={index}>Item {index}</div>
      ))}
    </FeedCarousel>,
  );
  return screen.getByTestId('feed-carousel-track');
}

describe('FeedCarousel', () => {
  it('renders its children in a single horizontal row, in the given order', () => {
    renderCarousel();

    const items = screen.getAllByText(/Item \d/).map((el) => el.textContent);
    expect(items).toEqual(['Item 0', 'Item 1', 'Item 2']);
  });

  it('disables the "previous" control when there is nothing earlier to show', () => {
    const track = renderCarousel();
    stubTrackDimensions(track, { scrollWidth: 1000, clientWidth: 300, scrollLeft: 0 });
    fireEvent.scroll(track);

    expect(screen.getByRole('button', { name: /previous articles/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /next articles/i })).toBeEnabled();
  });

  it('disables the "next" control once the end of the list is reached', () => {
    const track = renderCarousel();
    stubTrackDimensions(track, { scrollWidth: 1000, clientWidth: 300, scrollLeft: 700 });
    fireEvent.scroll(track);

    expect(screen.getByRole('button', { name: /next articles/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /previous articles/i })).toBeEnabled();
  });

  it('scrolls toward later items when "next" is clicked', async () => {
    const track = renderCarousel();
    stubTrackDimensions(track, { scrollWidth: 1000, clientWidth: 300, scrollLeft: 0 });
    fireEvent.scroll(track);
    const scrollBySpy = vi.fn();
    track.scrollBy = scrollBySpy;

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /next articles/i }));

    expect(scrollBySpy).toHaveBeenCalledTimes(1);
    const call = scrollBySpy.mock.calls[0][0] as { left: number; behavior: string };
    expect(call.left).toBeGreaterThan(0);
    expect(call.behavior).toBe('smooth');
  });

  it('scrolls back toward earlier items when "previous" is clicked', async () => {
    const track = renderCarousel();
    stubTrackDimensions(track, { scrollWidth: 1000, clientWidth: 300, scrollLeft: 700 });
    fireEvent.scroll(track);
    const scrollBySpy = vi.fn();
    track.scrollBy = scrollBySpy;

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /previous articles/i }));

    expect(scrollBySpy).toHaveBeenCalledTimes(1);
    const call = scrollBySpy.mock.calls[0][0] as { left: number; behavior: string };
    expect(call.left).toBeLessThan(0);
  });

  it('the previous/next controls are real buttons operable via the keyboard', async () => {
    const track = renderCarousel();
    stubTrackDimensions(track, { scrollWidth: 1000, clientWidth: 300, scrollLeft: 0 });
    fireEvent.scroll(track);
    const scrollBySpy = vi.fn();
    track.scrollBy = scrollBySpy;

    const nextButton = screen.getByRole('button', { name: /next articles/i });
    expect(nextButton.tagName).toBe('BUTTON');

    nextButton.focus();
    const user = userEvent.setup();
    await user.keyboard('{Enter}');

    expect(scrollBySpy).toHaveBeenCalledTimes(1);
  });

  it('does not show empty placeholder slots when there are fewer items than fit on screen', () => {
    renderCarousel(2);

    expect(screen.getAllByText(/Item \d/)).toHaveLength(2);
  });
});
