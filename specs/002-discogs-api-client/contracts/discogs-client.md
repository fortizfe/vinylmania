# Contract: Discogs Catalog Client (backend library)

This feature adds no new HTTP endpoint. The "contract" other backend code
depends on is this module's exported function signatures, documented here
before implementation per the constitution's API-contracts-first
requirement.

Module: `backend/src/discogs/discogsClient.ts`

## searchCatalog(query, options?)

```ts
function searchCatalog(
  query: string,
  options?: { resultType?: 'release' | 'artist'; page?: number; perPage?: number },
): Promise<{
  results: CatalogSearchResult[];
  pagination: { page: number; pages: number; items: number; perPage: number };
}>
```

- **query**: free-text search string (FR-001). An empty/whitespace-only
  query resolves to an empty `results` array without calling Discogs (edge
  case: empty query handled without crashing).
- **options.resultType**: scopes the search to `'release'` or `'artist'`
  (FR-001). Omitted = Discogs' default (mixed results across all types);
  callers in this codebase are expected to always pass one, per spec scope.
- **Throws**: `DiscogsRateLimitError`, `DiscogsUnavailableError`,
  `DiscogsValidationError`. Never throws for "no matches" — that's an empty
  `results` array (spec User Story 1, scenario 3).

## getRelease(discogsReleaseId)

```ts
function getRelease(discogsReleaseId: number): Promise<Release>
```

- **discogsReleaseId**: a Discogs release ID, typically obtained from a
  prior `searchCatalog()` result's `discogsId`.
- **Throws**: `DiscogsNotFoundError` (ID doesn't exist in Discogs — spec
  User Story 2, scenario 2), `DiscogsRateLimitError`,
  `DiscogsUnavailableError`, `DiscogsValidationError`.

## getArtist(discogsArtistId)

```ts
function getArtist(discogsArtistId: number): Promise<Artist>
```

- **discogsArtistId**: a Discogs artist ID.
- **Throws**: `DiscogsNotFoundError` (spec User Story 3, scenario 2),
  `DiscogsRateLimitError`, `DiscogsUnavailableError`,
  `DiscogsValidationError`.

## Error taxonomy (`backend/src/discogs/discogsErrors.ts`)

All extend a common `DiscogsError` base (has `.message` safe for a caller to
surface, and an internal `.cause`/detail logged separately — never both
mixed into the same string, per Principle V / Additional Constraints):

| Error class | Thrown when | Caller-safe message example |
|---|---|---|
| `DiscogsNotFoundError` | Discogs returns 404 for a given release/artist ID | "No release/artist found for that ID." |
| `DiscogsRateLimitError` | Discogs returns 429 | "The catalog service is busy right now — please try again shortly." |
| `DiscogsUnavailableError` | Network failure or Discogs 5xx | "The catalog service is temporarily unavailable." |
| `DiscogsValidationError` | Response body doesn't match the expected shape (zod validation failure) | "Received unexpected data from the catalog service." |

Every thrown error is logged (via the existing `backend/src/config/logger.ts`)
with the real cause, the endpoint called, and the ID/query involved — the
message above is only what a caller would be safe to bubble up to an end
user later.

## Observability requirements (Principle V)

The client MUST log, for every request to Discogs: `endpoint`, `outcome`
(`success` / `not_found` / `rate_limited` / `unavailable` / `validation_error`),
and Discogs' own `X-Discogs-Ratelimit-Remaining` header value when present —
sufficient to see usage trending toward the limit before it starts failing.
