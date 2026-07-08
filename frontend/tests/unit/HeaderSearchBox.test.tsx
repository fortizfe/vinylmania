import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation, useNavigate } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import { HeaderSearchBox } from '../../src/components/HeaderSearchBox';

function LocationDisplay() {
  const location = useLocation();
  return <div data-testid="location">{`${location.pathname}${location.search}`}</div>;
}

function GoToWishlistButton() {
  const navigate = useNavigate();
  return (
    <button type="button" onClick={() => navigate('/app/wishlist')}>
      Go to wishlist
    </button>
  );
}

function renderBox(initialEntries: string[] = ['/app']) {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <HeaderSearchBox />
      <LocationDisplay />
      <GoToWishlistButton />
    </MemoryRouter>,
  );
}

describe('HeaderSearchBox', () => {
  it('renders a search textbox', () => {
    renderBox();

    expect(
      screen.getByRole('searchbox', { name: /search discogs/i }),
    ).toBeInTheDocument();
  });

  it('navigates to the search results page with the trimmed query on submit', async () => {
    const user = userEvent.setup();
    renderBox(['/app']);

    await user.type(
      screen.getByRole('searchbox', { name: /search discogs/i }),
      '  stockholm  ',
    );
    await user.click(screen.getByRole('button', { name: /search/i }));

    expect(screen.getByTestId('location')).toHaveTextContent('/app/search?q=stockholm');
  });

  it('does not navigate when the query is empty or whitespace-only', async () => {
    const user = userEvent.setup();
    renderBox(['/app']);

    await user.type(screen.getByRole('searchbox', { name: /search discogs/i }), '   ');
    await user.click(screen.getByRole('button', { name: /search/i }));

    expect(screen.getByTestId('location')).toHaveTextContent('/app');
    expect(screen.getByTestId('location')).not.toHaveTextContent('/app/search');
  });

  it('initializes the input from the q param when mounted on the results page', () => {
    renderBox(['/app/search?q=miles+davis']);

    expect(screen.getByRole('searchbox', { name: /search discogs/i })).toHaveValue(
      'miles davis',
    );
  });

  it('resets to empty when navigating away from the results page', async () => {
    const user = userEvent.setup();
    renderBox(['/app/search?q=stockholm']);

    const input = screen.getByRole('searchbox', { name: /search discogs/i });
    expect(input).toHaveValue('stockholm');

    await user.click(screen.getByRole('button', { name: /go to wishlist/i }));

    expect(screen.getByTestId('location')).toHaveTextContent('/app/wishlist');
    expect(input).toHaveValue('');
  });
});
