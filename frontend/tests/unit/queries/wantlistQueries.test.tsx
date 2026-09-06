import { QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createTestQueryClient } from '../../testUtils';

const mockAdd = vi.fn();

vi.mock('../../../src/services/wantlistApi', () => ({
  add: (...args: unknown[]) => mockAdd(...args),
}));

describe('wantlistQueries — useAddToWantlist (feature 060, US2, T037)', () => {
  beforeEach(() => {
    mockAdd.mockReset();
  });

  it('invalidates every wantlist query on a successful add so /app/wishlist reflects it immediately', async () => {
    mockAdd.mockResolvedValue({
      discogsReleaseId: 5,
      rating: 0,
      notes: null,
      addedAt: '2026-09-06T00:00:00.000Z',
      catalogStatus: 'ok',
      release: null,
      alreadyInWantlist: false,
      alreadyInLibrary: false,
    });

    const client = createTestQueryClient();
    const invalidateSpy = vi.spyOn(client, 'invalidateQueries');
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );

    const { useAddToWantlist, wantlistKeys } =
      await import('../../../src/queries/wantlistQueries');
    const { result } = renderHook(() => useAddToWantlist(), { wrapper });

    result.current.mutate({ discogsReleaseId: 5 });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockAdd).toHaveBeenCalledWith(5);
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: wantlistKeys.all });
    // wantlistKeys.all is the prefix of both the list and the detail keys,
    // so a single invalidation refreshes the wishlist list and any open
    // wantlist-entry detail query.
    expect(wantlistKeys.detail(5).slice(0, 1)).toEqual(wantlistKeys.all);
  });
});
