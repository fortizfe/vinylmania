# Application Contract: `resolveCatalogCredential`

**Feature**: 053-catalog-oauth-attribution | **Layer**: `application/discogsCatalog/resolveCatalogCredential.ts`
**Depends on**: `ports/discogsOauth/discogsConnectionPort.ts` (existing, unchanged)

```ts
export async function resolveCatalogCredential(
  discogsConnection: DiscogsConnectionPort,
  uid: string,
): Promise<CatalogCredential>;
```

## Behavior

| `discogsConnection.getConnection(uid)` result | Returned `CatalogCredential` |
|---|---|
| `null` (no linked account — existing, documented port behavior) | `{ type: 'vinylmania' }` |
| `DiscogsConnection` (linked, regardless of whether it's still valid against Discogs) | `{ type: 'user', connection }` |

- **Never throws.** Unlike `application/library/syncLibrary.ts`'s `requireConnection` (which throws `DiscogsNotLinkedError` because collection requires a link), this function has no "required" case — spec FR-002 forbids blocking an unlinked user from catalog.
- **Does not itself detect revocation.** Whether `connection`'s stored tokens are still valid against Discogs is discovered only when the resulting `user`-typed credential is actually used to sign a request (`DiscogsAuthError` on 401/403, per `contracts/discogs-catalog-port.md`) — this function does not make a Discogs call to "pre-validate" the connection, avoiding an extra Discogs round-trip per catalog request.
- **Called once per incoming vinylmania request** (not once per internal Discogs call) — see `research.md` Decision 3's Performance rationale.

## Consumers

- `adapters/discogsCatalog/discogsRoutes.ts` — every route handler (search, release, master, master versions) calls this once with `req.auth.uid`, before invoking the corresponding `DiscogsCatalogPort` method(s).
- `application/discogsCatalog/searchCatalogWithRatings.ts` — called once per `searchCatalogWithRatings` invocation; the resolved value is threaded into every internal port call the use case makes.

## Test doubles

A test `DiscogsConnectionPort` stub (already used by existing library tests, e.g. `backend/tests/unit/library/application/syncLibrary.test.ts`) is reused as-is — no new fixture type needed, since this function's only input is the existing `getConnection` method.
