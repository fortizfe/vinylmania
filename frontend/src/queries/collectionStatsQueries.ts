import { useCallback, useEffect, useRef, useState } from 'react';
import {
  useQuery,
  useQueryClient,
  type QueryClient,
  type UseQueryResult,
} from '@tanstack/react-query';

import * as collectionStatsApi from '../services/collectionStatsApi';
import type {
  CollectionStatistics,
  CollectionValuation,
  PerDiscValue,
  ValuationChunkResponse,
} from '../services/collectionStatsApi';
import { ApiError } from '../services/apiClient';

const collectionStatsKeys = {
  all: ['collection-stats'] as const,
  statistics: () => [...collectionStatsKeys.all, 'statistics'] as const,
  valuation: () => [...collectionStatsKeys.all, 'valuation'] as const,
};

/**
 * Block 1. `retry: false` so the link-required gate (`discogs_not_linked` /
 * `discogs_link_invalid`) surfaces immediately instead of after retries.
 */
export function useCollectionStatistics(): UseQueryResult<CollectionStatistics> {
  return useQuery({
    queryKey: collectionStatsKeys.statistics(),
    queryFn: () => collectionStatsApi.getStatistics(false),
    retry: false,
  });
}

/** A non-blocking notice raised by the valuation loop, or `null`. */
type ValuationNotice = 'seller_settings' | 'unavailable' | null;

export type ValuationStatus = 'idle' | 'loading' | 'partial' | 'complete' | 'unavailable';

interface ProgressiveValuation {
  /** Running totals; `null` until the first chunk resolves. */
  valuation: CollectionValuation | null;
  /**
   * Full per-disc list — only present once the loop reaches `complete`
   * (intermediate chunks omit it to keep payloads small; data-model §5).
   */
  perDisc: PerDiscValue[] | null;
  /** Fraction in `[0, 1]` of instances attempted so far. */
  progress: number;
  notice: ValuationNotice;
  status: ValuationStatus;
  /**
   * Discs whose price lookup failed transiently and can be retried without
   * re-pricing the whole collection (US3, FR-025). `0` when there is nothing
   * to retry.
   */
  retryable: number;
  /**
   * Re-drive the loop from `cursor=0`.
   * - `'all'` (default): discard the running snapshot and start over — used by
   *   the unavailable-notice retry.
   * - `'failed'`: keep the running total on screen and only re-price the discs
   *   that failed transiently — used by the retryable-discs affordance.
   */
  retry: (mode?: 'all' | 'failed') => void;
}

/** Short client backoff before retrying the same cursor on a transient outage. */
const BACKOFF_MS = 1_500;
const MAX_TRANSIENT_RETRIES = 3;

function attemptedCount(valuation: CollectionValuation | null): number {
  if (!valuation) {
    return 0;
  }
  return (
    valuation.coveredCount +
    valuation.uncovered.noMarketData +
    valuation.uncovered.noCondition
  );
}

function deriveProgress(
  valuation: CollectionValuation | null,
  status: ValuationStatus,
): number {
  if (status === 'complete') {
    return 1;
  }
  if (!valuation || valuation.totalCount === 0) {
    return 0;
  }
  return Math.min(1, attemptedCount(valuation) / valuation.totalCount);
}

interface LoopState {
  valuation: CollectionValuation | null;
  perDisc: PerDiscValue[] | null;
  notice: ValuationNotice;
  status: ValuationStatus;
  retryable: number;
}

const INITIAL: LoopState = {
  valuation: null,
  perDisc: null,
  notice: null,
  status: 'idle',
  retryable: 0,
};

type RunMode = 'auto' | 'all' | 'failed';

/**
 * The running snapshot is mirrored into the query cache so navigating away and
 * back shows the last total instantly while the loop restarts at `cursor=0`
 * (every already-priced release is a warm server-side cache hit — cheap — but
 * the displayed number must never flash back to zero). US3 scenario 2.
 */
function readSnapshot(queryClient: QueryClient): LoopState | undefined {
  return queryClient.getQueryData<LoopState>(collectionStatsKeys.valuation());
}

function writeSnapshot(queryClient: QueryClient, next: LoopState): void {
  queryClient.setQueryData(collectionStatsKeys.valuation(), {
    ...next,
    notice: null,
  });
}

/**
 * Block 2. Drives the chunked-valuation contract
 * (`contracts/collection-stats-api.md` — "Frontend consumption"): fetch
 * `cursor=0` on mount, then follow `nextCursor` while the server reports
 * `partial`, accumulating the running `CollectionValuation` the server folds
 * for us. A transient `unavailable` mid-run (Discogs paced or briefly down) is retried
 * on the *same* cursor after a short backoff, a bounded number of times, so
 * partial results already on screen are never lost. The loop cancels on
 * unmount. `seller_settings_required` (HTTP 422) surfaces as a non-blocking
 * `notice`, never an error — Block 1 must stay usable (FR-012, FR-020).
 *
 * A small `useEffect` loop (not `useInfiniteQuery`) because the stop condition
 * is server-driven and the same-cursor backoff/retry on a `200 unavailable`
 * body doesn't map onto React Query's error-retry model.
 */
export function useProgressiveValuation(enabled = true): ProgressiveValuation {
  const queryClient = useQueryClient();
  // Seed synchronously from any cached running snapshot so a remount shows the
  // last total on the very first frame (US3 scenario 2).
  const [state, setState] = useState<LoopState>(
    () => readSnapshot(queryClient) ?? INITIAL,
  );
  const [runId, setRunId] = useState(0);
  const modeRef = useRef<RunMode>('auto');

  const retry = useCallback(
    (mode: 'all' | 'failed' = 'all') => {
      modeRef.current = mode;
      if (mode === 'all') {
        queryClient.removeQueries({ queryKey: collectionStatsKeys.valuation() });
        setState(INITIAL);
      }
      setRunId((id) => id + 1);
    },
    [queryClient],
  );

  // Guard against a slow chunk resolving after the component unmounts.
  const activeRef = useRef(true);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    const mode = modeRef.current;
    activeRef.current = true;
    const timers: ReturnType<typeof setTimeout>[] = [];

    const sleep = (ms: number) =>
      new Promise<void>((resolve) => {
        timers.push(setTimeout(resolve, ms));
      });

    const commit = (next: LoopState) => {
      if (activeRef.current) {
        setState(next);
      }
    };

    const record = (next: LoopState) => {
      commit(next);
      if (next.valuation) {
        writeSnapshot(queryClient, next);
      }
    };

    async function run() {
      const cached = mode === 'all' ? undefined : readSnapshot(queryClient);

      // A finished valuation is still valid on a plain remount — show it, don't
      // re-drive the loop. A `'failed'` retry always re-drives.
      if (mode === 'auto' && cached && cached.status === 'complete') {
        commit(cached);
        return;
      }

      const seed: LoopState =
        cached && cached.valuation
          ? { ...cached, notice: null, status: 'partial' }
          : { ...INITIAL, status: 'loading' };
      commit(seed);

      let cursor = 0;
      let transientRetries = 0;
      let running: CollectionValuation | null = seed.valuation;
      let retryable = seed.retryable;

      while (activeRef.current) {
        let chunk: ValuationChunkResponse;
        try {
          chunk =
            mode === 'failed'
              ? await collectionStatsApi.getValuationChunk(cursor, false, 'failed')
              : await collectionStatsApi.getValuationChunk(cursor);
        } catch (error) {
          if (error instanceof ApiError && error.code === 'seller_settings_required') {
            commit({
              valuation: running,
              perDisc: null,
              notice: 'seller_settings',
              status: 'unavailable',
              retryable,
            });
            return;
          }
          // Network / unexpected failure — treat as an outage, keep what we have.
          commit({
            valuation: running,
            perDisc: null,
            notice: 'unavailable',
            status: running ? 'partial' : 'unavailable',
            retryable,
          });
          return;
        }

        if (!activeRef.current) {
          return;
        }

        if (chunk.status === 'unavailable') {
          running = chunk.valuation ?? running;
          const canRetry = transientRetries < MAX_TRANSIENT_RETRIES;
          commit({
            valuation: running,
            perDisc: null,
            notice: 'unavailable',
            status: running && attemptedCount(running) > 0 ? 'partial' : 'unavailable',
            retryable,
          });
          if (!canRetry) {
            return;
          }
          transientRetries += 1;
          await sleep(BACKOFF_MS * transientRetries);
          continue; // same cursor
        }

        // partial | complete
        transientRetries = 0;
        running = chunk.valuation;
        retryable = chunk.retryable ?? 0;
        const done = chunk.status === 'complete';
        record({
          valuation: running,
          perDisc: done ? (chunk.perDisc ?? null) : null,
          notice: null,
          status: done ? 'complete' : 'partial',
          retryable,
        });

        if (done || chunk.nextCursor == null) {
          return;
        }
        cursor = chunk.nextCursor;
      }
    }

    void run();

    return () => {
      activeRef.current = false;
      timers.forEach(clearTimeout);
    };
  }, [enabled, runId, queryClient]);

  return {
    valuation: state.valuation,
    perDisc: state.perDisc,
    progress: deriveProgress(state.valuation, state.status),
    notice: state.notice,
    status: state.status,
    retryable: state.retryable,
    retry,
  };
}
