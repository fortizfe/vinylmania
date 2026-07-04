# Phase 0 Research: Application Caching (Frontend State & Backend Responses)

All items below were resolved from the existing codebase (`backend/src/discogs/discogsClient.ts`, `backend/src/config/firebase-admin.ts`, `frontend/src/services/*`, `frontend/src/pages/RecordDetailPage.tsx`) plus the explicit stakeholder mandate in the spec's Assumptions. No unresolved `NEEDS CLARIFICATION` markers remain in the Technical Context.

## 1. Frontend state cache: TanStack Query setup

- **Decision**: Add `@tanstack/react-query` (latest v5). Create one module-level `QueryClient` in `frontend/src/lib/queryClient.ts` with project-wide defaults:
  - `staleTime`: a few minutes for catalog/read data (Discogs releases/search results rarely change) — data is "fresh" and won't even trigger a background refetch on remount within this window.
  - `gcTime` (formerly `cacheTime`): kept at the library default (5 minutes) so unused query data is evicted after the user navigates away and doesn't return.
  - `refetchOnWindowFocus`: left at the library default (`true`) — this is what delivers "background refresh without blocking the view" (FR-002) for long-lived tabs.
  - Mount `<QueryClientProvider client={queryClient}>` once in `frontend/src/main.tsx`, wrapping `<App />` alongside the existing `<AuthProvider>`.
- **Rationale**: This is TanStack Query's own documented standard configuration ("keep it standardized" per the user's explicit request) — a single shared client, sane defaults, no custom cache implementation. Matches FR-001/FR-002/FR-003 (instant display of cached data, background revalidation, loading state only on true first load) out of the box via `useQuery`'s `isLoading` (no data yet) vs `isFetching` (background refetch) distinction.
- **Alternatives considered**: Hand-rolled context + `useReducer` cache (rejected — reinvents what TanStack Query already does correctly, violates Simplicity/YAGNI by building a bespoke cache); SWR (rejected — user explicitly specified TanStack Query).

## 2. Frontend query key & hook organization

- **Decision**: One hooks module per resource under `frontend/src/queries/` (`libraryQueries.ts`, `discogsQueries.ts`), each exporting:
  - Query key factories (e.g., `libraryKeys.list(page, pageSize)`, `libraryKeys.detail(entryId)`, `discogsKeys.search(query, type, page)`, `discogsKeys.release(discogsId)`) so keys are constructed consistently and are easy to target for invalidation.
  - `useQuery`-based read hooks that call the existing `frontend/src/services/*Api.ts` functions unchanged (no service-layer rewrite needed — TanStack Query wraps the existing fetch functions as query functions).
  - `useMutation`-based write hooks (create/update/remove) that call `queryClient.invalidateQueries({ queryKey: libraryKeys.all })` (or a more targeted key) `onSuccess`, satisfying FR-004.
- **Rationale**: Keeps cache concerns in a dedicated, testable module (Principle II — Library-First & Modularity) rather than scattering `useQuery` calls with ad hoc string keys across page components. Existing `services/*Api.ts` functions are reused as-is, minimizing churn.
- **Alternatives considered**: Calling `useQuery` directly inside page components with inline keys (rejected — duplicated/inconsistent keys make targeted invalidation error-prone, and the pattern would need to be re-learned per page instead of standardized once).

## 3. Backend response cache: Redis + ioredis setup

- **Decision**: Add `ioredis`. Create `backend/src/cache/redisClient.ts` exporting a `getRedisClient()` function that lazily constructs and memoizes a single `Redis` instance from `process.env.REDIS_URL`, mirroring the existing reuse pattern in `getFirebaseApp()` (`backend/src/config/firebase-admin.ts`) — this is required because the backend runs as Vercel serverless functions (`backend/vercel.json` rewrites to `api/index.ts`), where a fresh TCP connection per invocation would exhaust connection limits and add latency.
- **Rationale**: `ioredis` is the standard, most widely-adopted Redis client for Node — matches the user's explicit request and needs no non-standard configuration beyond `REDIS_URL` (compatible with any managed Redis provider that exposes a standard `redis://`/`rediss://` endpoint, e.g. Redis Cloud/Upstash-with-TCP, keeping provider choice a deployment concern rather than a code concern).
- **Alternatives considered**: A REST-based Redis client (e.g., Upstash's HTTP SDK) — rejected because the user explicitly asked for ioredis, and ioredis's persistent-connection model is well-suited once connection reuse is handled the same way Firebase Admin already is in this codebase.

## 4. Cache-aside wrapper around the Discogs client

- **Decision**: Add `backend/src/cache/cacheAside.ts` exporting `withCache<T>(key: string, ttlSeconds: number, fetcher: () => Promise<T>): Promise<T>` that: reads `key` from Redis, returns the parsed hit and logs `cache_hit`; on miss, calls `fetcher()`, stores the JSON-serialized result with `EX ttlSeconds`, and logs `cache_miss`; if any Redis operation throws (connection error, timeout), logs a `cache_unavailable` warning and falls through to calling `fetcher()` directly without caching the result (satisfies FR-008 — never fail a request because the cache is down). Wrap only the three read-only Discogs functions (`searchCatalog`, `getRelease`, `getArtist`) in `discogsClient.ts`, keyed by their normalized arguments (e.g., `discogs:search:<type>:<query>:<page>:<perPage>`, `discogs:release:<id>`, `discogs:artist:<id>`).
- **Rationale**: A cache-aside (lazy-loading) pattern is the standard approach for caching read-through external API responses and requires no changes to callers (`routes/discogs.ts`, `library/libraryEnrichment.ts` keep calling the same exported functions) — satisfies Open/Closed (Principle IV) and Simplicity (Principle III). TTL-based expiration satisfies FR-007. Because `libraryEnrichment.ts` already calls `getRelease` once per library entry per list view, wrapping `getRelease` itself (rather than only the route handler) means the enrichment path benefits automatically, which is the single highest-value caching point in the app today.
- **Alternatives considered**: Express response-caching middleware keyed by request URL (rejected — would also need to special-case auth headers out of the key and wouldn't cover the internal `getRelease` calls made from `libraryEnrichment.ts`, which never go through an HTTP route); a generic decorator/AOP library (rejected — unnecessary abstraction for three call sites, violates YAGNI).

## 5. Cache TTL values

- **Decision**: Use a generous but bounded TTL for Discogs data since catalog metadata (release/artist details, search results) changes rarely: release/artist lookups get a longer TTL (hours), search results a shorter TTL (tens of minutes) since result ordering/relevance can shift as Discogs's catalog grows. Exact numeric values are a configuration constant in `backend/src/cache/cacheAside.ts` (or env-overridable), not a business rule — no spec requirement ties correctness to a specific duration.
- **Rationale**: Matches FR-007 (all cached entries must expire) and SC-003 (reduced average response time) without any risk of serving indefinitely-stale catalog data, since Discogs is the sole source of truth for that data (per the constitution's Vinyl Data Source rule) and the cache is always safely re-fillable.
- **Alternatives considered**: No expiration + manual invalidation (rejected — no mechanism exists or is needed to know when Discogs's own data changes; TTL-based staleness is the standard, simplest correct approach).

## 6. Testing strategy

- **Decision**: Backend — use `ioredis-mock` (new devDependency) in Jest unit tests for `cacheAside.ts` (hit, miss, and Redis-throws-so-bypass scenarios) per Principle I (Test-First); existing `nock`-based Discogs contract/integration tests get an added assertion that a second identical call does not trigger a second `nock` interceptor consumption. Frontend — wrap render helpers in `frontend/tests/setup.ts` (or a shared test util) with a fresh `QueryClientProvider` per test (retry disabled, so failures surface immediately) and assert cached-instant-render + invalidation-after-mutation behavior with Testing Library.
- **Rationale**: Keeps the Red-Green-Refactor cycle intact for the new cache behavior specifically (not just the pre-existing business logic it wraps), consistent with Principle I.
- **Alternatives considered**: Spinning up a real Redis instance in CI for unit tests (rejected as the default — `ioredis-mock` is the standard, fast, dependency-free way to unit-test cache-aside logic; a real Redis MAY still be used for local manual/integration verification per `quickstart.md`, but is not required for the automated suite).

## 7. Observability

- **Decision**: Extend the existing `LogOutcome` union in `backend/src/config/logger.ts` with `cache_hit`, `cache_miss`, and `cache_unavailable`, emitted by `withCache` via the existing `logger.info`/`logger.warn` functions (same structured JSON line format already used for Discogs rate-limit logging).
- **Rationale**: Satisfies FR-009 (operational visibility into cache effectiveness) using the project's existing, already-constitutionally-mandated structured logging (Principle V) rather than introducing a new metrics/observability tool.
- **Alternatives considered**: A dedicated metrics/APM integration (rejected — out of scope per YAGNI; the app has no existing metrics pipeline, and structured logs are the established, greppable pattern here).
