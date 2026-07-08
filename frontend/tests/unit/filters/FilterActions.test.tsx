import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { FilterActions } from '../../../src/components/filters/FilterActions';

describe('FilterActions (feature 023, US3)', () => {
  it('renders Apply and Clear with distinct accessible names and no visible text (FR-010, FR-011, FR-013)', () => {
    render(<FilterActions onClear={vi.fn()} />);

    const applyButton = screen.getByRole('button', { name: /^apply filters$/i });
    const clearButton = screen.getByRole('button', { name: /^clear filters$/i });

    expect(applyButton.textContent?.trim()).toBe('');
    expect(clearButton.textContent?.trim()).toBe('');
  });

  it('renders two visually distinct icons for Apply and Clear (FR-012)', () => {
    render(<FilterActions onClear={vi.fn()} />);

    const applySvg = screen
      .getByRole('button', { name: /^apply filters$/i })
      .querySelector('svg');
    const clearSvg = screen
      .getByRole('button', { name: /^clear filters$/i })
      .querySelector('svg');

    expect(applySvg).toBeInTheDocument();
    expect(clearSvg).toBeInTheDocument();
    expect(applySvg?.outerHTML).not.toBe(clearSvg?.outerHTML);
  });

  it('the Apply button submits its enclosing form', () => {
    const onSubmit = vi.fn((event) => event.preventDefault());
    render(
      <form onSubmit={onSubmit}>
        <FilterActions onClear={vi.fn()} />
      </form>,
    );

    screen.getByRole('button', { name: /^apply filters$/i }).click();

    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it('calls onClear when the Clear button is activated', async () => {
    const onClear = vi.fn();
    const user = userEvent.setup();
    render(<FilterActions onClear={onClear} />);

    await user.click(screen.getByRole('button', { name: /^clear filters$/i }));

    expect(onClear).toHaveBeenCalledTimes(1);
  });
});
