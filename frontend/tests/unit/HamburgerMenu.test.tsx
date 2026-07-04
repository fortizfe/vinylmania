import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import { HamburgerMenu } from '../../src/components/HamburgerMenu';

function renderMenu() {
  return render(
    <MemoryRouter>
      <HamburgerMenu />
    </MemoryRouter>,
  );
}

describe('HamburgerMenu', () => {
  it('starts closed, with no navigation links visible', () => {
    renderMenu();

    expect(screen.queryByRole('link', { name: /my library/i })).not.toBeInTheDocument();
  });

  it('opening the trigger does not itself navigate anywhere', async () => {
    const user = userEvent.setup();
    renderMenu();

    await user.click(screen.getByRole('button', { name: /menu/i }));

    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('shows exactly three links, in order, pointing at the right destinations', async () => {
    const user = userEvent.setup();
    renderMenu();

    await user.click(screen.getByRole('button', { name: /menu/i }));

    const links = screen.getAllByRole('link');
    expect(links).toHaveLength(3);
    expect(links[0]).toHaveAccessibleName(/my library/i);
    expect(links[0]).toHaveAttribute('href', '/app/library');
    expect(links[1]).toHaveAccessibleName(/my wishlist/i);
    expect(links[1]).toHaveAttribute('href', '/app/wishlist');
    expect(links[2]).toHaveAccessibleName(/profile/i);
    expect(links[2]).toHaveAttribute('href', '/app/profile');
  });

  it('closes when a link is selected', async () => {
    const user = userEvent.setup();
    renderMenu();

    await user.click(screen.getByRole('button', { name: /menu/i }));
    await user.click(screen.getByRole('link', { name: /my library/i }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('closes on Escape', async () => {
    const user = userEvent.setup();
    renderMenu();

    await user.click(screen.getByRole('button', { name: /menu/i }));
    await user.keyboard('{Escape}');

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
