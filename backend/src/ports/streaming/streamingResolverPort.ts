import type {
  ResolvedStreamingLink,
  StreamingLinkQuery,
  StreamingPlatform,
} from '../../domain/streaming/types';

/**
 * A resolver for one streaming platform.
 *
 * Contract:
 * - `resolve` returns a {@link ResolvedStreamingLink} when the record is
 *   reliably present on the platform.
 * - returns `null` for a **confirmed no-match** (the record is not on this
 *   platform). The use case caches this outcome for 90 days.
 * - throws a `StreamingResolutionError` — and **only** that — for a
 *   **transient** failure (upstream timeout, 5xx, rate-limit, unparseable
 *   response). A transient failure is NOT cached; the next view re-resolves.
 *
 * A resolver MUST NOT throw for "record not on this platform", and MUST NOT
 * return a link it is not confident about (research.md §3 — never a wrong or
 * broken link).
 *
 * ── To add a streaming platform ────────────────────────────────────────────
 * 1. Implement `StreamingResolverPort` in
 *    `adapters/streaming/<x>Adapter.ts` (mirror `itunesSearchAdapter.ts`), and
 *    add the platform id to `StreamingPlatform` in `domain/streaming/types.ts`.
 * 2. Add the adapter instance to the `resolvers` array in
 *    `adapters/streaming/streamingRoutes.ts`.
 * 3. Add a frontend platform-metadata row + icon in
 *    `frontend/src/components/StreamingLinksSection.tsx`.
 * Nothing else changes — not this port, not the `resolveStreamingLinks` use
 * case, not the `matching` domain, not any other platform's adapter.
 */
export interface StreamingResolverPort {
  /** Stable identifier for the platform this resolver handles. */
  readonly platform: StreamingPlatform;

  resolve(query: StreamingLinkQuery): Promise<ResolvedStreamingLink | null>;
}
