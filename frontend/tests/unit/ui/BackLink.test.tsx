import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import { BackLink } from '../../../src/components/ui/BackLink';

describe('BackLink', () => {
  it('renders a link to the given path with the default "Back" label', () => {
    render(
      <MemoryRouter>
        <BackLink to="/app/library" />
      </MemoryRouter>,
    );

    const link = screen.getByRole('link', { name: /back/i });
    expect(link).toHaveAttribute('href', '/app/library');
  });

  it('supports a custom label', () => {
    render(
      <MemoryRouter>
        <BackLink to="/app/library" label="Back to library" />
      </MemoryRouter>,
    );

    expect(screen.getByRole('link', { name: /back to library/i })).toBeInTheDocument();
  });

  it('meets the 44px minimum touch target height (FR-004)', () => {
    render(
      <MemoryRouter>
        <BackLink to="/app/library" />
      </MemoryRouter>,
    );

    expect(screen.getByRole('link', { name: /back/i }).className).toMatch(/min-h-11/);
  });

  it('nudges toward the chevron on press and adopts the shared focusRing (US1)', () => {
    render(
      <MemoryRouter>
        <BackLink to="/app/library" />
      </MemoryRouter>,
    );

    const link = screen.getByRole('link', { name: /back/i });
    expect(link.className).toMatch(/active:-translate-x-0\.5/);
    expect(link.className).toMatch(/motion-reduce:active:translate-x-0/);
    expect(link.className).toContain('focus-visible:ring-primary');
  });
});
