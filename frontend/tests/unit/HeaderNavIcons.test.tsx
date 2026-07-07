import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import { HeaderNavIcons } from '../../src/components/HeaderNavIcons';

function renderIcons() {
  return render(
    <MemoryRouter>
      <HeaderNavIcons />
    </MemoryRouter>,
  );
}

describe('HeaderNavIcons', () => {
  it('renders exactly three icon links, in order, pointing at the right destinations', () => {
    renderIcons();

    const links = screen.getAllByRole('link');
    expect(links).toHaveLength(3);
    expect(links[0]).toHaveAccessibleName(/my library/i);
    expect(links[0]).toHaveAttribute('href', '/app/library');
    expect(links[1]).toHaveAccessibleName(/my wishlist/i);
    expect(links[1]).toHaveAttribute('href', '/app/wishlist');
    expect(links[2]).toHaveAccessibleName(/profile/i);
    expect(links[2]).toHaveAttribute('href', '/app/profile');
  });

  it('is reachable via Tab in DOM order and activatable with Enter', async () => {
    const user = userEvent.setup();
    renderIcons();

    await user.tab();
    expect(screen.getByRole('link', { name: /my library/i })).toHaveFocus();

    await user.tab();
    expect(screen.getByRole('link', { name: /my wishlist/i })).toHaveFocus();

    await user.tab();
    expect(screen.getByRole('link', { name: /profile/i })).toHaveFocus();
  });

  it('activating a focused icon with Enter navigates the same as a click', async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route path="/" element={<HeaderNavIcons />} />
          <Route path="/app/wishlist" element={<h1>Wishlist page</h1>} />
        </Routes>
      </MemoryRouter>,
    );

    await user.tab();
    await user.tab();
    expect(screen.getByRole('link', { name: /my wishlist/i })).toHaveFocus();

    await user.keyboard('{Enter}');

    expect(await screen.findByRole('heading', { name: /wishlist page/i })).toBeInTheDocument();
  });
});
