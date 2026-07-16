# Port Contract: `FeedSourcePort` (new)

**Feature**: 049-feeds-hexagonal-migration | **Layer**: `ports/feeds/feedSourcePort.ts`
**Adapter**: `adapters/feeds/feedSourceAdapter.ts` (new — relocated + adapted from
`feeds/feedClient.ts`)
**Status**: New port, no prior version to preserve compatibility with — this domain had
no port before this migration.

```ts
import type { RawFeedItem } from '../../domain/feeds/types';

export interface FeedSourcePort {
  /**
   * Fetches one feed URL and returns its parsed items as domain-owned
   * `RawFeedItem`s — never a type belonging to the underlying HTTP client or
   * RSS/Atom parsing library (spec.md FR-012). Rejects on a non-2xx
   * response, a network-level failure, or exceeding `timeoutMs`; callers
   * (this domain's application layer) are responsible for degrading a
   * rejection into a per-source "unavailable" status rather than failing
   * the whole request — this port itself does not catch or retry.
   */
  fetchFeed(feedUrl: string, timeoutMs?: number): Promise<RawFeedItem[]>;
}
```

## Preconditions / Postconditions

- `feedUrl`: any string; the adapter does not validate it beyond what the HTTP client
  itself rejects (matches `feeds/feedClient.ts`'s current behavior — no URL validation
  today).
- `timeoutMs`: optional; defaults to `8_000` (`DEFAULT_TIMEOUT_MS`, unchanged from
  today). Each call is independently timed — a slow or hung source's timeout MUST NOT
  extend or block another concurrent call's own timeout (spec.md Edge Cases,
  per-source isolation).
- Return value: `RawFeedItem[]` — the adapter's own translation of the parsed feed's
  items, built field-by-field from `rss-parser`'s `Parser.Item` (see data-model.md's
  `RawFeedItem` entry for the exact field list). Never `rss-parser`'s `Parser.Output`
  wrapper object.
- Rejection: any HTTP error (non-2xx, network failure, timeout) rejects the returned
  promise with the underlying error — this port performs no error translation or
  domain-error wrapping, matching `feeds/feedClient.ts`'s current behavior (it does not
  catch anything; `feedAggregator.ts`'s `Promise.allSettled` is what converts a
  rejection into a per-source `'unavailable'` status).

## Consumers introduced by this feature

- `application/feeds/getFeedsDashboard.ts`'s private `fetchSourceArticles` helper — the
  only consumer, shared by both `getDashboard` and `getSourceArticles` (research.md
  Decision 2).

## Unaffected by this feature

No other domain consumes this port — it is new and scoped entirely to `feeds/`
(data-model.md's cross-domain-consumer edge case).
