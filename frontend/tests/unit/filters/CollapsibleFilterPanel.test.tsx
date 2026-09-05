import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { CollapsibleFilterPanel } from '../../../src/components/filters/CollapsibleFilterPanel';

describe('CollapsibleFilterPanel (feature 038, US1)', () => {
  it('renders collapsed by default, without the children (FR-002)', () => {
    render(
      <CollapsibleFilterPanel activeCount={0}>
        <div data-testid="filter-fields">fields</div>
      </CollapsibleFilterPanel>,
    );

    expect(screen.getByRole('button', { name: /^filters$/i })).toBeInTheDocument();
    expect(screen.queryByTestId('filter-fields')).not.toBeInTheDocument();
  });

  it('the collapse trigger inherits the shared pressed-state from Button (US1 T042)', () => {
    render(
      <CollapsibleFilterPanel activeCount={0}>
        <div>fields</div>
      </CollapsibleFilterPanel>,
    );

    expect(
      screen.getByRole('button', { name: /^filters$/i }).className,
    ).toMatch(/active:scale-\[0\.97\]/);
  });

  it('shows no active-filter badge when activeCount is 0 (FR-005)', () => {
    render(
      <CollapsibleFilterPanel activeCount={0}>
        <div>fields</div>
      </CollapsibleFilterPanel>,
    );

    expect(screen.queryByTestId('active-filter-badge')).not.toBeInTheDocument();
  });

  it('shows an active-filter badge/counter when activeCount is greater than 0 (FR-004)', () => {
    render(
      <CollapsibleFilterPanel activeCount={3}>
        <div>fields</div>
      </CollapsibleFilterPanel>,
    );

    expect(screen.getByTestId('active-filter-badge')).toHaveTextContent('3');
  });

  it('expands and reveals the children when the collapsed trigger is clicked (FR-002)', async () => {
    const user = userEvent.setup();
    render(
      <CollapsibleFilterPanel activeCount={0}>
        <div data-testid="filter-fields">fields</div>
      </CollapsibleFilterPanel>,
    );

    await user.click(screen.getByRole('button', { name: /^filters$/i }));

    expect(screen.getByTestId('filter-fields')).toBeInTheDocument();
  });

  it('does not auto-collapse when an action inside the children is used (FR-003)', async () => {
    const user = userEvent.setup();
    render(
      <CollapsibleFilterPanel activeCount={0}>
        <button type="button">Apply filters</button>
      </CollapsibleFilterPanel>,
    );

    await user.click(screen.getByRole('button', { name: /^filters$/i }));
    await user.click(screen.getByRole('button', { name: /apply filters/i }));

    expect(screen.getByRole('button', { name: /apply filters/i })).toBeInTheDocument();
  });

  it('collapses back to the compact trigger when the explicit collapse control is used (FR-003)', async () => {
    const user = userEvent.setup();
    render(
      <CollapsibleFilterPanel activeCount={0}>
        <div data-testid="filter-fields">fields</div>
      </CollapsibleFilterPanel>,
    );

    await user.click(screen.getByRole('button', { name: /^filters$/i }));
    expect(screen.getByTestId('filter-fields')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /collapse filters/i }));

    expect(screen.queryByTestId('filter-fields')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^filters$/i })).toBeInTheDocument();
  });

  describe('disclosure motion (US2)', () => {
    it('wraps the revealed children in a height + opacity motion container', async () => {
      const user = userEvent.setup();
      render(
        <CollapsibleFilterPanel activeCount={0}>
          <div data-testid="filter-fields">fields</div>
        </CollapsibleFilterPanel>,
      );

      await user.click(screen.getByRole('button', { name: /^filters$/i }));

      const panel = screen.getByTestId('filter-fields').parentElement as HTMLElement;
      expect(panel.className).toMatch(/overflow-hidden/);
      // motion/react renders the current animated values as inline styles.
      expect(panel.getAttribute('style') ?? '').toMatch(/opacity|height/);
    });

    it('rotates the disclosure chevron between the collapsed and expanded states on the collapse token', async () => {
      const user = userEvent.setup();
      const { container } = render(
        <CollapsibleFilterPanel activeCount={0}>
          <div>fields</div>
        </CollapsibleFilterPanel>,
      );

      const collapsedChevron = container.querySelector('svg') as SVGElement;
      expect(collapsedChevron.getAttribute('class')).toMatch(
        /transition-transform duration-\(--motion-duration-collapse\) ease-out/,
      );
      expect(collapsedChevron.getAttribute('class')).toMatch(/rotate-180/);

      await user.click(screen.getByRole('button', { name: /^filters$/i }));

      const expandedChevron = container.querySelector('svg') as SVGElement;
      expect(expandedChevron.getAttribute('class')).toMatch(/rotate-0/);
    });
  });

  it('keeps showing the active-filter badge on the collapsed trigger after re-collapsing (FR-004)', async () => {
    const user = userEvent.setup();
    render(
      <CollapsibleFilterPanel activeCount={2}>
        <div>fields</div>
      </CollapsibleFilterPanel>,
    );

    await user.click(screen.getByRole('button', { name: /^filters$/i }));
    await user.click(screen.getByRole('button', { name: /collapse filters/i }));

    expect(screen.getByTestId('active-filter-badge')).toHaveTextContent('2');
  });
});
