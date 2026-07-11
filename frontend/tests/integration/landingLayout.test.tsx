import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import { AuthProvider } from '../../src/auth/AuthContext';
import { LandingPage } from '../../src/pages/LandingPage';

vi.mock('firebase/auth', () => ({
  signInWithPopup: vi.fn(),
  signOut: vi.fn(),
  onAuthStateChanged: (_auth: unknown, callback: (user: null) => void) => {
    callback(null);
    return () => undefined;
  },
}));

vi.mock('../../src/services/firebaseClient', () => ({
  firebaseAuth: {},
  googleAuthProvider: {},
}));

function renderLandingPage() {
  return render(
    <MemoryRouter>
      <AuthProvider>
        <LandingPage />
      </AuthProvider>
    </MemoryRouter>,
  );
}

describe('LandingPage layout', () => {
  it('renders the value proposition and the Google sign-in CTA inside the landing viewport container', () => {
    renderLandingPage();

    const viewport = screen.getByTestId('landing-viewport');

    const heading = screen.getByRole('heading', { level: 1 });
    const cta = screen.getByRole('button', { name: /sign in with google/i });

    expect(viewport).toContainElement(heading);
    expect(viewport).toContainElement(cta);
  });

  it('renders the hero heading and supporting copy with both light- and dark-mode design tokens', () => {
    renderLandingPage();

    const heading = screen.getByRole('heading', { level: 1 });
    const copy = screen.getByText(/track your collection with discogs/i);

    // Both elements must carry a `dark:` variant alongside their light-mode
    // classes, so the refreshed hero stays consistent with the rest of the
    // app's design system in both themes (FR-002).
    expect(heading.className).toMatch(/dark:/);
    expect(copy.className).toMatch(/dark:/);
  });

  it('renders the sign-in action inside a sticky header, not the scrollable body', () => {
    renderLandingPage();

    const header = screen.getByRole('banner');
    const cta = screen.getByRole('button', { name: /sign in with google/i });

    expect(header).toContainElement(cta);
    expect(header.className).toMatch(/sticky/);
  });

  it('renders three pillar sections below the hero, each with a heading and descriptive text', () => {
    renderLandingPage();

    const pillarHeadings = screen.getAllByRole('heading', { level: 2 });
    expect(pillarHeadings).toHaveLength(3);

    expect(screen.getByRole('heading', { name: /catalog/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /rating/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /news/i })).toBeInTheDocument();
  });
});
