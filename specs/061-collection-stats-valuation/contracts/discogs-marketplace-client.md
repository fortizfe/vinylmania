# Contract: `DiscogsMarketplacePort` ↔ Discogs price suggestions

`backend/src/ports/discogsOauth/discogsMarketplacePort.ts` — one method. Implemented by
`backend/src/adapters/discogsOauth/discogsMarketplaceAdapter.ts` (OAuth-signed).

```ts
import type { DiscogsConnection } from '../../domain/discogsOauth/types';
import type { MediaCondition } from '../../domain/discogsOauth/conditionGrading';

export interface ConditionPrice {
  currency: string;   // ISO 4217, e.g. "EUR" — the user's Discogs seller currency
  value: number;      // suggested price for that grade
}

/** Full per-grade map, or null when Discogs has no market data for the release. */
export type PriceSuggestions = Partial<Record<MediaCondition, ConditionPrice>> | null;

export interface DiscogsMarketplacePort {
  getPriceSuggestions(
    connection: DiscogsConnection,
    releaseId: number,
  ): Promise<PriceSuggestions>;
}
```

## Upstream call

`GET {DISCOGS_OAUTH_BASE_URL}/marketplace/price_suggestions/{releaseId}` — OAuth 1.0a
signed with the consumer credentials + the connection's access token/secret (identical
header construction to `discogsCollectionAdapter`).

### Upstream 200 body

```jsonc
{
  "Very Good (VG)":            { "currency": "EUR", "value": 4.95 },
  "Very Good Plus (VG+)":      { "currency": "EUR", "value": 7.10 },
  "Near Mint (NM or M-)":      { "currency": "EUR", "value": 12.40 },
  "Mint (M)":                  { "currency": "EUR", "value": 15.00 }
  // grades with no data are simply absent
}
```

Keys are exactly the strings in `MEDIA_CONDITIONS` (`conditionGrading.ts`) → direct
lookup, no mapping. The adapter returns the object as-is (typed as `PriceSuggestions`).

## Mapping rules

| Upstream | Port result |
|----------|-------------|
| `200` with ≥ 1 grade | the object |
| `200` empty `{}` / `404` | `null` (no market data — negative-cached, FR-016) |
| `401` / `403` **with the seller-settings signal** (Discogs returns a 403 with a body/message indicating seller settings are required) | throw `SellerSettingsRequiredError` |
| `401` / `403` otherwise (revoked token) | throw `DiscogsAuthError` (existing) |
| `429` after `MAX_ATTEMPTS` | throw `DiscogsRateLimitError` (existing) |
| `5xx` / network / circuit open | throw `DiscogsUnavailableError` (existing) |

Phase-2 note: the exact 403 discriminator (status alone vs. body inspection) is confirmed
against the live API and the e2e stub during implementation; default to treating **any**
`403` on this endpoint as `SellerSettingsRequiredError` and any `401` as `DiscogsAuthError`,
since a valid OAuth token that reached collection endpoints is unlikely to be rejected
here except for seller settings.

## Resilience (reused verbatim — FR-021)

The adapter's axios instance uses the **same** interceptor wiring as
`discogsCollectionAdapter.createClient`:

- **request**: `shouldShortCircuit()` → reject with `CircuitOpenError`; set OAuth
  `Authorization` per request; `await acquireSlot()` (shared preventive throttle).
- **response (success)**: `recordRateLimitHeaders(headers)`, `recordSuccess()`.
- **response (error)**: `CircuitOpenError` → `DiscogsUnavailableError`; `recordRateLimitHeaders`;
  `401/403` → auth/seller-settings per table above; `404` → treated as `null` by the
  method (not an error); `classifyForRetry` + `backoffDelayMs` for `429`/`5xx` up to
  `MAX_ATTEMPTS` (this GET **is** retry-eligible); `recordExhaustedFailure()` on exhaustion.

The circuit breaker and rate limiter are process-global singletons, so this client shares
the one per-IP Discogs budget with the catalog and collection clients automatically.

## Caching (adapter-level, FR-022)

`getPriceSuggestions` wraps the upstream call in
`cacheAdapter.withCache('discogs:pricesuggest:{uid}:{releaseId}', 7*24*3600, fetcher)`.
The `null` (no-market-data) result is cached at the same TTL (negative cache) so a
data-less release is not re-requested on every visit. `withCache` already gives
single-flight coalescing and fail-soft on a Redis outage.

## E2E stub (`e2e/helpers/discogsOauthStub.ts`)

Add `GET /marketplace/price_suggestions/:releaseId`:
- seeded releases → a deterministic per-grade map in `EUR`;
- one seeded release → `404` (drives the "estimado sobre X de Y" assertion);
- requests carrying the "no-seller-settings" test account's token → `403` with the
  seller-settings body.
