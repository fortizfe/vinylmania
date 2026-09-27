import { QueryClientProvider } from '@tanstack/react-query';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AppHeader } from '../../src/components/AppHeader';
import { ApiError, setUnauthorizedHandler } from '../../src/services/apiClient';
import type { CatalogSuggestion } from '../../src/services/discogsApi';
import {
  clearSessionToken,
  getSessionToken,
  setSessionToken,
} from '../../src/services/sessionStore';
import { createTestQueryClient } from '../testUtils';

const { mockSuggest } = vi.hoisted(() => ({ mockSuggest: vi.fn() }));

vi.mock('../../src/services/discogsApi', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../src/services/discogsApi')>()),
  suggest: mockSuggest,
}));

vi.mock('../../src/auth/AuthContext', () => ({
  useAuth: () => ({ signOut: vi.fn() }),
}));

function LocationDisplay() {
  const location = useLocation();
  return <div data-testid="location">{`${location.pathname}${location.search}`}</div>;
}

function renderHeader(initialEntries: string[] = ['/app']) {
  return render(
    <QueryClientProvider client={createTestQueryClient()}>
      <MemoryRouter initialEntries={initialEntries}>
        <AppHeader />
        <LocationDisplay />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('Header search (US1)', () => {
  it('shows the search box alongside the brand link and the existing header controls', () => {
    renderHeader();

    expect(screen.getByRole('link', { name: /vinylmania/i })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: /search discogs/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /menu/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sign out/i })).toBeInTheDocument();
  });

  it('renders the same search box regardless of which authenticated page the header is mounted on', () => {
    renderHeader(['/app/library']);

    expect(screen.getByRole('combobox', { name: /search discogs/i })).toBeInTheDocument();
  });
});

// --- 069 US2: suggestions end to end ---------------------------------------

interface Deferred<T> {
  promise: Promise<T>;
  resolve: (value: T) => void;
}

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

function album(
  title: string,
  overrides: Partial<CatalogSuggestion> = {},
): CatalogSuggestion {
  return {
    discogsId: 1,
    resultType: 'master',
    title,
    artist: 'Miles Davis',
    year: 1959,
    format: 'Vinyl',
    thumbnailUrl: 'https://example.com/cover.jpg',
    ...overrides,
  };
}

/** The backdrop, or null while the search is collapsed (contracts §2). */
function scrim(): HTMLElement | null {
  return document.querySelector<HTMLElement>('div.overlay-scrim');
}

function opener(): HTMLElement {
  return screen.getByRole('button', { name: /search/i });
}

function searchField(): HTMLInputElement {
  return screen.getByRole('combobox', { name: /search discogs/i });
}

describe('Header search — suggestions (069 US2)', () => {
  beforeEach(() => {
    mockSuggest.mockReset();
  });

  it('renders only the rows of the query currently in the field when a slower earlier lookup lands last (FR-013, SC-005)', async () => {
    const slow = deferred<CatalogSuggestion[]>();
    const fast = deferred<CatalogSuggestion[]>();
    mockSuggest.mockImplementation((query: string) =>
      query === 'mil' ? slow.promise : fast.promise,
    );

    const user = userEvent.setup();
    renderHeader();

    await user.click(opener());
    await user.type(searchField(), 'mil');
    await waitFor(() => expect(mockSuggest).toHaveBeenCalledWith('mil'), {
      timeout: 2000,
    });

    await user.type(searchField(), 'es');
    await waitFor(() => expect(mockSuggest).toHaveBeenCalledWith('miles'), {
      timeout: 2000,
    });

    await act(async () => {
      fast.resolve([album('Kind Of Blue')]);
    });
    expect(await screen.findByText('Kind Of Blue')).toBeInTheDocument();

    // The superseded response lands last and is neither rendered nor allowed
    // to replace what the collector is looking at.
    await act(async () => {
      slow.resolve([album('Milestones')]);
    });
    expect(screen.queryByText('Milestones')).toBeNull();
    expect(screen.getByText('Kind Of Blue')).toBeInTheDocument();
  });

  it('renders and announces nothing when a lookup cleared mid-flight finally lands (FR-015)', async () => {
    const pending = deferred<CatalogSuggestion[]>();
    mockSuggest.mockReturnValue(pending.promise);

    const user = userEvent.setup();
    renderHeader();

    await user.click(opener());
    await user.type(searchField(), 'miles');
    await waitFor(() => expect(mockSuggest).toHaveBeenCalledWith('miles'), {
      timeout: 2000,
    });

    await user.clear(searchField());
    await act(async () => {
      pending.resolve([album('Kind Of Blue')]);
    });

    expect(screen.queryByRole('listbox')).toBeNull();
    expect(screen.queryByText('Kind Of Blue')).toBeNull();
    expect(screen.getByRole('status')).toHaveTextContent('');
  });

  it('opens the master detail and collapses the search when a master suggestion is chosen (FR-012, SC-002)', async () => {
    mockSuggest.mockResolvedValue([
      album('Kind Of Blue', { discogsId: 42, resultType: 'master' }),
    ]);

    const user = userEvent.setup();
    renderHeader();

    await user.click(opener());
    await user.type(searchField(), 'miles');
    await user.click(
      await screen.findByText('Kind Of Blue', undefined, {
        timeout: 2000,
      }),
    );

    expect(screen.getByTestId('location')).toHaveTextContent('/app/masters/42');
    expect(scrim()).toBeNull();
  });

  it('opens the release detail and collapses the search when a release suggestion is chosen (FR-012, SC-002)', async () => {
    mockSuggest.mockResolvedValue([
      album('Kind Of Blue', { discogsId: 7, resultType: 'release' }),
    ]);

    const user = userEvent.setup();
    renderHeader();

    await user.click(opener());
    await user.type(searchField(), 'miles');
    await user.click(
      await screen.findByText('Kind Of Blue', undefined, {
        timeout: 2000,
      }),
    );

    expect(screen.getByTestId('location')).toHaveTextContent('/app/releases/7');
    expect(scrim()).toBeNull();
  });

  it('opens the full results for an artist suggestion and collapses the search (FR-012, research D17)', async () => {
    mockSuggest.mockResolvedValue([
      {
        discogsId: 99,
        resultType: 'artist',
        title: 'Miles Davis',
        thumbnailUrl: 'https://example.com/miles.jpg',
      } satisfies CatalogSuggestion,
    ]);

    const user = userEvent.setup();
    renderHeader();

    await user.click(opener());
    await user.type(searchField(), 'miles');
    await user.click(
      await screen.findByText('Miles Davis', undefined, {
        timeout: 2000,
      }),
    );

    // The app has no artist screen, so an artist row lands on the results
    // screen through the same `buildSearchPath` the submit path uses.
    expect(screen.getByTestId('location')).toHaveTextContent('/app/search?q=Miles+Davis');
    expect(scrim()).toBeNull();
  });
});

// --- 069 US4: empty and error states end to end -----------------------------

describe('Header search — empty and error states (069 US4)', () => {
  const UNAVAILABLE = 'Suggestions are unavailable. Retry is available.';

  beforeEach(() => {
    mockSuggest.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    setUnauthorizedHandler(null);
    clearSessionToken();
  });

  function status(): HTMLElement {
    return screen.getByRole('status');
  }

  it('shows the error state and announces it politely when the lookup is rejected (FR-019, FR-023)', async () => {
    mockSuggest.mockRejectedValue(new ApiError('Upstream failed', 502, 'upstream_error'));

    const user = userEvent.setup();
    renderHeader();

    await user.click(opener());
    await user.type(searchField(), 'miles');

    expect(
      await screen.findByRole('button', { name: 'Retry' }, { timeout: 2000 }),
    ).toBeInTheDocument();
    expect(status()).toHaveTextContent(UNAVAILABLE);
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('re-runs the same query and returns to loading when Retry is activated (FR-019)', async () => {
    mockSuggest.mockRejectedValueOnce(
      new ApiError('Upstream failed', 502, 'upstream_error'),
    );
    mockSuggest.mockReturnValueOnce(deferred<CatalogSuggestion[]>().promise);

    const user = userEvent.setup();
    renderHeader();

    await user.click(opener());
    await user.type(searchField(), 'miles');
    const retry = await screen.findByRole('button', { name: 'Retry' }, { timeout: 2000 });

    await user.click(retry);

    await waitFor(() => expect(mockSuggest).toHaveBeenCalledTimes(2));
    expect(mockSuggest).toHaveBeenNthCalledWith(1, 'miles');
    expect(mockSuggest).toHaveBeenNthCalledWith(2, 'miles');

    // Back in `loading`: skeletons, no Retry, and the loading announcement.
    expect(await screen.findByRole('listbox')).toBeInTheDocument();
    expect(
      screen.getByRole('listbox').querySelectorAll('li[aria-hidden="true"]'),
    ).toHaveLength(5);
    expect(screen.queryByRole('button', { name: 'Retry' })).toBeNull();
    expect(status()).toHaveTextContent('Searching…');
    // Retry is not a submit: the collector is still where they were, search open.
    expect(screen.getByTestId('location')).toHaveTextContent(/^\/app$/);
    expect(searchField()).toHaveValue('miles');
  });

  it('announces the typed text when nothing matches (FR-018, FR-023)', async () => {
    mockSuggest.mockResolvedValue([]);

    const user = userEvent.setup();
    renderHeader();

    await user.click(opener());
    await user.type(searchField(), 'zzqx');

    await waitFor(
      () => expect(status()).toHaveTextContent('No suggestions for “zzqx”.'),
      { timeout: 2000 },
    );
  });

  it('still reaches the full results screen when the typed query is submitted during a failing lookup (FR-020, SC-009)', async () => {
    mockSuggest.mockRejectedValue(new ApiError('Upstream failed', 502, 'upstream_error'));

    const user = userEvent.setup();
    renderHeader();

    await user.click(opener());
    await user.type(searchField(), 'miles');
    await screen.findByRole('button', { name: 'Retry' }, { timeout: 2000 });

    await user.type(searchField(), '{Enter}');

    expect(screen.getByTestId('location')).toHaveTextContent('/app/search?q=miles');
  });

  it('leaves a session-expired rejection to the existing sign-in path instead of showing the error state (spec edge case)', async () => {
    // The real `suggest` → `authorizedFetch` path, so the 401 goes through the
    // same session clearing + `onUnauthorized` hook AuthContext registers.
    const actual = await vi.importActual<typeof import('../../src/services/discogsApi')>(
      '../../src/services/discogsApi',
    );
    mockSuggest.mockImplementation(actual.suggest);
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        json: async () => ({
          error: 'unauthorized',
          message: 'Sign-in required or session expired.',
        }),
      }),
    );
    setSessionToken('stale-token');
    const onUnauthorized = vi.fn();
    setUnauthorizedHandler(onUnauthorized);

    const user = userEvent.setup();
    renderHeader();

    await user.click(opener());
    await user.type(searchField(), 'miles');

    await waitFor(() => expect(onUnauthorized).toHaveBeenCalledTimes(1), {
      timeout: 2000,
    });
    expect(getSessionToken()).toBeNull();
    expect(screen.queryByRole('button', { name: 'Retry' })).toBeNull();
    expect(status()).not.toHaveTextContent(UNAVAILABLE);
  });

  it('shows the error state for a revoked Discogs link, which is not a session expiry (spec 053)', async () => {
    const actual = await vi.importActual<typeof import('../../src/services/discogsApi')>(
      '../../src/services/discogsApi',
    );
    mockSuggest.mockImplementation(actual.suggest);
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        json: async () => ({
          error: 'discogs_link_invalid',
          message: 'Your Discogs link is no longer valid.',
        }),
      }),
    );
    setSessionToken('valid-token');
    const onUnauthorized = vi.fn();
    setUnauthorizedHandler(onUnauthorized);

    const user = userEvent.setup();
    renderHeader();

    await user.click(opener());
    await user.type(searchField(), 'miles');

    expect(
      await screen.findByRole('button', { name: 'Retry' }, { timeout: 2000 }),
    ).toBeInTheDocument();
    expect(status()).toHaveTextContent(UNAVAILABLE);
    expect(onUnauthorized).not.toHaveBeenCalled();
    expect(getSessionToken()).toBe('valid-token');
  });
});
