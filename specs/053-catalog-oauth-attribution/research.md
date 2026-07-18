# Phase 0 Research: Identificar toda petición a Discogs con la cuenta vinculada del usuario

All items below were resolved by reading the current codebase (see citations); no `NEEDS CLARIFICATION` markers remain in the Technical Context.

## Decision 1 — Credential representation: `CatalogCredential` discriminated union

**Decision**: Introduce
```ts
export type CatalogCredential =
  | { readonly type: 'vinylmania' }
  | { readonly type: 'user'; readonly connection: DiscogsConnection };
```
in `backend/src/domain/discogsCatalog/types.ts`, reusing the existing `DiscogsConnection` type (`backend/src/domain/discogsOauth/types.ts:5-19`) as-is — no new fields needed (`accessToken`/`accessTokenSecret` are already there).

**Rationale**: The spec defines exactly two legitimate identification states (FR-001/FR-002/FR-004) with no third "in-between" — a closed union sized to the actual requirement (Principle III, YAGNI). Reusing `DiscogsConnection` avoids a parallel type for the same data collection already resolves.

**Alternatives considered**: A boolean `isLinked` + separate `uid`/token params — rejected, loses type-safety (nothing would stop passing a `uid` without its connection, or vice versa) and doesn't match the existing collection convention of passing the resolved `DiscogsConnection` object itself.

## Decision 2 — Where credential resolution happens: new Application-layer function

**Decision**: Add `application/discogsCatalog/resolveCatalogCredential.ts`:
```ts
export async function resolveCatalogCredential(
  discogsConnection: DiscogsConnectionPort,
  uid: string,
): Promise<CatalogCredential> {
  const connection = await discogsConnection.getConnection(uid);
  return connection ? { type: 'user', connection } : { type: 'vinylmania' };
}
```
Called once per incoming vinylmania route handler (routes stay thin, matching Constitution Principle VIII's "routes translate into an application use-case invocation").

**Rationale**: Mirrors the exact, already-reviewed pattern of `application/library/syncLibrary.ts:21-30`'s `requireConnection` — same port (`DiscogsConnectionPort.getConnection(uid)`, confirmed at `ports/discogsOauth/discogsConnectionPort.ts:39-40` to return `Promise<DiscogsConnection | null>`, never throwing for "not linked"), different terminal behavior: `requireConnection` throws `DiscogsNotLinkedError` because collection *requires* a link; `resolveCatalogCredential` must not throw for "not linked" (FR-002 forbids blocking unlinked users), so it returns the `vinylmania` variant instead. This is a one-word behavioral fork on top of an already-proven, tested pattern — no new Firestore access pattern, no new port.

**Alternatives considered**: Resolving credential inline inside `discogsCatalogAdapter.ts` (the Adapter fetching its own connection) — rejected: would make the Adapter both a business-rule decider ("prefer user, else app") and an infrastructure translator, violating Principle VIII's Adapter definition, and would require the Adapter to depend on `DiscogsConnectionPort` for a decision that belongs one layer up.

## Decision 3 — Threading the credential through `DiscogsCatalogPort`

**Decision**: Every `DiscogsCatalogPort` method gains `credential: CatalogCredential` as its **first** parameter (matching the established collection convention where `connection: DiscogsConnection` is always first in `discogsCollectionAdapter.ts`'s exported functions, e.g. `getFieldMap(connection, ...)`, `addReleaseToCollection(connection, ...)`). `searchCatalogWithRatings` (`application/discogsCatalog/searchCatalogWithRatings.ts`) must accept and thread the same credential into its **internal** `discogsCatalog.getMasterRelease(...)` and `discogsCatalog.getReleaseRating(...)` enrichment calls (lines ~59-60) — these are themselves catalog requests made on behalf of the same user and are explicitly in scope (spec lists "rating" as a covered action).

**Rationale**: A single resolved credential per incoming request, threaded explicitly, is simpler and more testable than an ambient/context-based mechanism (e.g. `AsyncLocalStorage`), and matches Principle III (no infrastructure beyond what's needed). Keeping parameter order consistent with collection avoids an inconsistent convention across two structurally similar ports.

**Alternatives considered**: Resolving credential separately inside each of `searchCatalogWithRatings`'s internal calls (one Firestore read per enrichment fan-out item) — rejected on the Performance Goals constraint (Technical Context): would multiply Firestore reads per search by the fan-out concurrency (up to 5, `SEARCH_RATING_CONCURRENCY`) instead of one resolution per incoming request.

## Decision 4 — HTTP client construction: parameterize, don't duplicate

**Decision**: Refactor `createDiscogsHttpClient()` (`backend/src/adapters/discogsCatalog/discogsCatalogAdapter.ts:90-186`) to accept an optional `getAuthorization: () => string | undefined` parameter (default = the existing `buildAuthorizationHeader` reading `DISCOGS_TOKEN`, `discogsCatalogAdapter.ts:57-60`), and move the `Authorization` header assignment from the static `axios.create({ headers: {...} })` call into the existing request interceptor (`discogsCatalogAdapter.ts:97-102`) so it's (re)computed per request rather than once at client construction. Add `buildUserAuthorizationHeader(connection: DiscogsConnection): string`, reusing `buildProtectedResourceHeader` + a local `getCatalogOauthCredentials()` (same `DISCOGS_CONSUMER_KEY`/`DISCOGS_CONSUMER_SECRET` env reads collection already does in `discogsCollectionAdapter.ts:43-49`) from `adapters/discogsOauth/oauthSignature.ts` (`buildProtectedResourceHeader`, lines 54-62 — already exported, already used by collection, no changes needed to that file). `getDiscogsHttpClient()`'s existing module-level singleton (lines 212-217) stays exactly as-is for the `vinylmania` credential path (zero behavior change, satisfying FR-002/FR-007); a new `getUserScopedDiscogsHttpClient(connection: DiscogsConnection)` builds a fresh client per call via the *same* `createDiscogsHttpClient(() => buildUserAuthorizationHeader(connection))`, mirroring collection's own "fresh client per call, no cross-user caching" choice (`discogsCollectionAdapter.ts:81`).

**Rationale**: This is the one deliberate refactor flagged in the Constitution Check. The alternative — copying `discogsCatalogAdapter.ts`'s ~150-line interceptor pipeline (circuit breaker check, rate-limit `acquireSlot`, retry/backoff, 401/403→`DiscogsAuthError` mapping, rate-limit header recording) into a second, catalog-specific "user-scoped client" function — would be the *third* copy of essentially the same pipeline in the codebase (collection already duplicated it once from catalog, per `discogsCollectionAdapter.ts`'s own comment "mirrors discogsCatalogAdapter.ts's feature 029 pattern"). Parameterizing instead keeps circuit breaker/rate-limiter sharing (already a deliberate cross-adapter design, feature 040) trivially correct — there's only one interceptor pipeline reading global `shouldShortCircuit()`/`acquireSlot()`/`recordSuccess()`, so it can't drift between a "vinylmania" and "user" variant. The 401/403 → `DiscogsAuthError` mapping (`discogsCatalogAdapter.ts:150-158`) is already credential-agnostic (it doesn't inspect which token was used) and needs zero changes — it already throws `DiscogsAuthError` on 401/403 regardless of Authorization header source, so a revoked user credential naturally produces exactly the error FR-003 requires, with no new "detect revocation" logic to write.

**Alternatives considered**: Full duplication mirroring collection's existing style (rejected above, compounds debt); an `AxiosInterceptorManager`-level "swap the client per call" registry (rejected as unneeded indirection, Principle III).

## Decision 5 — No silent fallback is enforced structurally, not by a runtime guard

**Decision**: There is no code path anywhere that catches a `DiscogsAuthError` from a `user`-credentialed request and retries with the `vinylmania` credential. `resolveCatalogCredential` is called exactly once per request; its result is passed straight through to one adapter call; on failure the error propagates to the route's `catch` block.

**Rationale**: FR-004 ("nunca debe actuar como sustituto de una cuenta vinculada activa y válida") is best guaranteed by *absence* of a fallback code path rather than a flag or check that could be forgotten or bypassed later — this is a design constraint the tasks phase must respect (no task should introduce a catch-and-retry-with-vinylmania-credential branch).

## Decision 6 — HTTP error contract: reuse collection's `discogs_link_invalid`, extract the shared mapping — gated on which credential actually failed

**Decision**: `adapters/discogsCatalog/discogsRoutes.ts`'s per-route `catch` blocks gain a new branch, but it is **not** a blind `err instanceof DiscogsAuthError` check — it must also check that the credential resolved *for that specific attempt* was the `user` variant:
```ts
if (err instanceof DiscogsAuthError && credential.type === 'user') {
  // -> 401 { error: 'discogs_link_invalid', message: '...' }
}
```
When `credential.type === 'vinylmania'`, a `DiscogsAuthError` (i.e. `DISCOGS_TOKEN` itself is invalid/misconfigured — an operational problem, not the user's link) falls through unchanged to the existing default `500 internal_error` branch, exactly as every catalog route already handles an unmatched error today. Extract only the "credential is `user` and error is `DiscogsAuthError`" → `401 discogs_link_invalid` mapping (status + body, byte-identical to `adapters/library/libraryRoutes.ts:99-107`) into a small shared helper both route files import, e.g. `adapters/discogs/respondDiscogsAuthError.ts`.

**Rationale**: Before this feature, catalog routes only ever used `DISCOGS_TOKEN`, so a 401/403 from Discogs could only ever mean "vinylmania's own token is broken" — and that case already, correctly, falls through to the generic 500 today (no route has ever special-cased it). This feature does not get to silently repurpose that existing fallthrough for a *different* meaning ("your account needs relinking") for a population (unlinked users) that has no account to relink — doing so would misinform an unlinked user that they have a broken Discogs *link* they never created. Gating the new branch on `credential.type === 'user'` preserves the pre-053 behavior byte-for-byte for the `vinylmania` path (zero regression for unlinked users or an app-wide `DISCOGS_TOKEN` outage) while adding the new, correctly-scoped 401 only for the population and situation FR-003 actually describes.

**Alternatives considered**: Unconditionally mapping any `DiscogsAuthError` to `discogs_link_invalid` regardless of credential type — rejected per the mis-attribution risk above (identified during plan review, not present in the initial draft of this decision). Calling `respondCollectionError` itself from `discogsRoutes.ts` — rejected: it also matches `DiscogsNotLinkedError` (409 `discogs_not_linked`), which must never occur on a catalog route (catalog never requires a link, FR-002), so reusing the whole function would leave a dead/misleading branch reachable only by a future bug, rather than being structurally impossible as Decision 5 aims for.

## Decision 7 — Audit logging: extend existing per-Discogs-call log sites, not `LogEvent`'s closed union

**Decision**: Add `credentialType: 'vinylmania' | 'user'` inside the existing `meta: Record<string, unknown>` field (`config/logger.ts`'s `LogEvent.meta` is already freeform) at the two existing per-actual-Discogs-call log sites in `discogsCatalogAdapter.ts`: `logRateLimit()` (success/not_found/rate_limited, line ~189) and the response interceptor's `auth_failed`/`unavailable` `logger.warn`/`logger.error` calls (lines 150-153, 176-185). No change to `LogEvent`'s typed fields or `LogOutcome` union.

**Rationale**: These are the log sites that fire once per actual outbound Discogs HTTP call (the right granularity for "toda petición a Discogs" per FR-005/SC-004, including each item of a search's rating-enrichment fan-out — each is its own Discogs call, its own log line, its own credential attribution) — as opposed to the coarser per-vinylmania-route logs (`route: '/api/discogs/search', outcome: 'success'`) that fire once per incoming HTTP request regardless of how many Discogs calls it triggered. Using `meta` (already the documented extension point for call-specific data, e.g. existing `rateLimitRemaining`/`attempts` fields) avoids widening `LogEvent`'s typed contract for one feature-specific field, consistent with Principle III. No token/secret is ever passed to any log call today (`getRelease(discogsReleaseId)` etc. carry no credential value into logging) — adding `credentialType` (a fixed two-value enum, never the token itself) preserves that.

**Alternatives considered**: A first-class `LogEvent.credentialType?: 'vinylmania' | 'user'` field — considered acceptable but rejected as unnecessary widening of a shared, closed-union-adjacent type for a single feature's field when `meta` already exists for exactly this purpose.

## Decision 8 — Caching: unchanged, confirmed by inspection

**Decision**: No change to `discogsCatalogAdapter.ts`'s cache keys (`discogs:release:${id}`, `discogs:artist:${id}`, `discogs:master:${id}`, `discogs:master-versions:${id}:${page}:${perPage}`, `discogs:rating:${id}` — all resource-ID-only, 6h/30min TTLs) or to `withCache`'s fail-soft/single-flight semantics (`adapters/cache/cacheAside.ts`).

**Rationale**: Confirms the spec's stated Assumption by inspection rather than by trust: `withCache`'s fetcher rejecting (which is exactly what happens when a `user`-credentialed call throws `DiscogsAuthError`) never populates the cache — only a *resolved* value is cached (`cacheAside.ts`'s `runCacheAside`), so a revoked-credential failure can never poison the shared cache with a wrong or missing entry, and a cache hit populated by either credential type serves identical Discogs-sourced content to any subsequent requester per spec FR-007.

## Decision 9 — Frontend: surface `discogs_link_invalid` on catalog *reads*, not just the collection *write*

**Decision**: `frontend/src/pages/SearchResultsPage.tsx`, `ReleaseDetailPage.tsx`, and `MasterReleaseDetailPage.tsx` currently only branch on `discogs_link_invalid` for the "add to library" mutation's `ApiError` (`SearchResultsPage.tsx:114`, `ReleaseDetailPage.tsx:40` — confirmed by inspection this branch is on `createEntry.mutateAsync`'s catch, not on the page's underlying `useCatalogSearchInfinite`/`useCatalogRelease`/`useCatalogMaster` query itself). Those query hooks (`frontend/src/queries/discogsQueries.ts`) don't special-case this error today — a revoked-link user's *catalog GET* itself would currently only produce whatever the hook's default `error` state renders. This feature must extend the pages (or the hooks) to detect `discogs_link_invalid` on the underlying catalog query's error too, and render the same relink prompt already used for the add-mutation case. Extract the duplicated prompt markup (currently inlined near-identically in two files, about to become three-plus call sites) into a small shared `DiscogsRelinkNotice` component, per the Constitution's UI rule ("once [a pattern] appears twice or more, it MUST be extracted into a component").

**Rationale**: Spec User Story 3 requires the user to actually *receive* the relink prompt when browsing catalog with a revoked link — not merely that the backend refrains from silently falling back. Since search/release/master pages are read (`useQuery`/`useInfiniteQuery`), not a mutation, this is new handling, not a copy of existing mutation-error handling.

**Alternatives considered**: Leaving the frontend catalog-read paths unchanged (relying only on a generic error boundary) — rejected: fails User Story 3's acceptance scenario ("el usuario recibe el mismo aviso de reconexión"), and produces a worse UX regression (a browsing action that used to always work now shows a generic error instead of the specific, actionable "please relink" message the app already has established for this exact situation).
