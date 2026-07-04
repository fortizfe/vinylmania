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
  it('renders the value proposition and the Google sign-in CTA inside a single no-scroll viewport container', () => {
    renderLandingPage();

    const viewport = screen.getByTestId('landing-viewport');

    const heading = screen.getByRole('heading', { level: 1 });
    const cta = screen.getByRole('button', { name: /sign in with google/i });

    // Both the value proposition and the CTA must live inside the same
    // single-viewport container — i.e. neither is rendered outside it in a
    // separate scrollable section.
    expect(viewport).toContainElement(heading);
    expect(viewport).toContainElement(cta);
  });

  it('does not wrap the landing content in a scrollable element', () => {
    renderLandingPage();

    const viewport = screen.getByTestId('landing-viewport');
    // Presence of an explicit scroll utility class would defeat the
    // no-scroll requirement (FR-001/FR-002).
    expect(viewport.className).not.toMatch(/scroll/i);
  });
});
