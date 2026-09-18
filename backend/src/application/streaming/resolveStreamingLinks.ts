import { createHash } from 'crypto';

import { logger } from '../../config/logger';
import { normalize } from '../../domain/streaming/matching';
import { StreamingResolutionError } from '../../domain/streaming/streamingErrors';
import type {
  ResolvedStreamingLink,
  StreamingLinkQuery,
  StreamingLinksResult,
} from '../../domain/streaming/types';
import type { CachePort } from '../../ports/cache/cachePort';
import type { StreamingResolverPort } from '../../ports/streaming/streamingResolverPort';

/** 90 days, per research.md §5 / data-model.md. */
export const STREAMING_CACHE_TTL_SECONDS = 90 * 24 * 60 * 60;

const STREAMING_ROUTE = '/api/streaming/links';

/** Optional per-request context, used only for structured logging (FR-019). */
interface ResolveStreamingLinksContext {
  uid?: string;
}

interface ResolveStreamingLinksUseCase {
  resolveStreamingLinks(
    query: StreamingLinkQuery,
    context?: ResolveStreamingLinksContext,
  ): Promise<StreamingLinksResult>;
}

/** Digits only, empty dropped, de-duplicated, sorted — a stable barcode set. */
function normalizedBarcodes(barcodes: readonly string[]): string[] {
  return Array.from(
    new Set(
      barcodes
        .map((barcode) => barcode.replace(/\D/g, ''))
        .filter((barcode) => barcode.length > 0),
    ),
  ).sort();
}

/**
 * Content-derived record identity (data-model.md "Cache key"):
 * `sha1(sortedNormalisedBarcodes.join(',') + '|' + normalize(artist) + '|' + normalize(title))`.
 * The same record resolves to the same cache entry from every surface without
 * threading Discogs IDs through the caller.
 */
export function buildRecordKey(query: StreamingLinkQuery): string {
  const material = [
    normalizedBarcodes(query.barcodes).join(','),
    normalize(query.artist),
    normalize(query.title),
  ].join('|');
  return createHash('sha1').update(material).digest('hex');
}

export function createResolveStreamingLinksUseCase(deps: {
  resolvers: StreamingResolverPort[];
  cache: CachePort;
}): ResolveStreamingLinksUseCase {
  const { resolvers, cache } = deps;

  async function resolveStreamingLinks(
    query: StreamingLinkQuery,
    context: ResolveStreamingLinksContext = {},
  ): Promise<StreamingLinksResult> {
    const recordKey = buildRecordKey(query);
    const method = normalizedBarcodes(query.barcodes).length > 0 ? 'barcode' : 'text';

    // Per-platform isolation (FR-005): each resolver runs inside its own
    // cache lookup; `allSettled` guarantees one rejecting never rejects the
    // batch. A `null` IS cached (confirmed no-match); a thrown
    // `StreamingResolutionError` propagates out of `withCache` uncached.
    const settled = await Promise.allSettled(
      resolvers.map((resolver) =>
        cache.withCache(
          `streaming:${resolver.platform}:${recordKey}:${query.storefront}`,
          STREAMING_CACHE_TTL_SECONDS,
          () => resolver.resolve(query),
        ),
      ),
    );

    const links: ResolvedStreamingLink[] = [];

    settled.forEach((outcome, index) => {
      const platform = resolvers[index].platform;
      const meta = { platform, method, storefront: query.storefront };

      if (outcome.status === 'fulfilled') {
        const link = outcome.value;
        if (link) {
          links.push({ platform: link.platform, url: link.url });
          logger.info({
            route: STREAMING_ROUTE,
            outcome: 'matched',
            uid: context.uid,
            meta,
          });
        } else {
          logger.info({
            route: STREAMING_ROUTE,
            outcome: 'no_match',
            uid: context.uid,
            meta,
          });
        }
        return;
      }

      const reason: unknown = outcome.reason;
      logger.warn({
        route: STREAMING_ROUTE,
        outcome: 'transient_failure',
        uid: context.uid,
        meta,
        message:
          reason instanceof StreamingResolutionError
            ? `${reason.code}: ${reason.message}`
            : reason instanceof Error
              ? reason.message
              : 'unknown error',
      });
    });

    return { links };
  }

  return { resolveStreamingLinks };
}
