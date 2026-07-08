import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { FeedCategoryFilterBar } from '../../src/components/FeedCategoryFilterBar';

describe('FeedCategoryFilterBar', () => {
  it('calls onSelectCategory with the chosen category when a category button is clicked', async () => {
    const onSelectCategory = vi.fn();
    render(
      <FeedCategoryFilterBar
        categories={['News', 'Reviews']}
        selectedCategory={null}
        onSelectCategory={onSelectCategory}
      />,
    );

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Reviews' }));

    expect(onSelectCategory).toHaveBeenCalledWith('Reviews');
  });

  it('calls onSelectCategory with null when "All" is clicked to clear the filter', async () => {
    const onSelectCategory = vi.fn();
    render(
      <FeedCategoryFilterBar
        categories={['News', 'Reviews']}
        selectedCategory="Reviews"
        onSelectCategory={onSelectCategory}
      />,
    );

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'All' }));

    expect(onSelectCategory).toHaveBeenCalledWith(null);
  });

  it('marks the currently selected category as pressed', () => {
    render(
      <FeedCategoryFilterBar
        categories={['News', 'Reviews']}
        selectedCategory="News"
        onSelectCategory={vi.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: 'News' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Reviews' })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByRole('button', { name: 'All' })).toHaveAttribute('aria-pressed', 'false');
  });
});
