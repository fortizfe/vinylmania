import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { UnderConstruction } from '../../src/components/UnderConstruction';

describe('UnderConstruction', () => {
  it('renders the given title', () => {
    render(<UnderConstruction title="Dashboard" />);

    expect(screen.getByText('Dashboard')).toBeInTheDocument();
  });

  it('renders a static under-construction message', () => {
    render(<UnderConstruction title="Profile" />);

    expect(screen.getByText(/under construction/i)).toBeInTheDocument();
  });
});
