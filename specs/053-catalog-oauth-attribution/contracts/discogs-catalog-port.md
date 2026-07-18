# Port Contract: `DiscogsCatalogPort` (extended)

**Feature**: 053-catalog-oauth-attribution | **Layer**: `ports/discogsCatalog/discogsCatalogPort.ts`
**Adapter**: `adapters/discogsCatalog/discogsCatalogAdapter.ts`
**Status**: Every method's signature gains a leading `credential: CatalogCredential` parameter. Return types, response shapes, and existing behavior (caching, mapping, error types) are unchanged — this is an identification-only change (research.md Decision 3).

```ts
export type CatalogCredential =
  | { readonly type: 'vinylmania' }
  | { readonly type: 'user'; readonly connection: DiscogsConnection };

export interface DiscogsCatalogPort {
  getRelease(credential: CatalogCredential, discogsReleaseId: number): Promise<Release>;

  getArtist(credential: CatalogCredential, discogsArtistId: number): Promise<Artist>;

  getMasterRelease(credential: CatalogCredential, masterId: number): Promise<MasterRelease>;

  getMasterReleaseVersions(
    credential: CatalogCredential,
    masterId: number,
    page?: number,
    perPage?: number,
  ): Promise<MasterReleaseVersionsPage>;

  getReleaseRating(credential: CatalogCredential, discogsReleaseId: number): Promise<CommunityRating>;

  searchCatalog(
    credential: CatalogCredential,
    query: string,
    options?: SearchCatalogOptions,
  ): Promise<CatalogSearchResponse>;
}
```

## Preconditions / Postconditions

- **Precondition**: `credential` MUST be produced by `resolveCatalogCredential` (application layer, see `contracts/catalog-credential-resolution.md`) — never hand-constructed by a route or test double representing production behavior. Contract tests MAY construct it directly to exercise both branches in isolation.
- **Postcondition (both variants)**: the resolved domain object (`Release`/`Artist`/`MasterRelease`/etc.) is byte-identical regardless of `credential.type`, per spec FR-007 — Discogs catalog content does not vary by identity.
- **Postcondition (`user` variant, revoked credentials)**: if Discogs responds 401/403 to a request signed with `credential.connection`'s tokens, the method's promise MUST reject with `DiscogsAuthError` (`discogs/discogsErrors.ts`) — unchanged from today's 401/403 handling, which is already credential-agnostic. The method MUST NOT retry the same call with the `vinylmania` credential (no such retry code path exists anywhere in the adapter — see research.md Decision 5).
- **Postcondition (`vinylmania` variant)**: identical wire behavior to the pre-053 adapter (same singleton client, same `DISCOGS_TOKEN` header) — a regression here would violate spec FR-002/SC-002.
- **Caching**: cache keys are unchanged (resource-ID-only, no credential dimension) — see `data-model.md` and research.md Decision 8. A rejected promise (either variant) is never cached; only a resolved value is.

## Consumers

- `adapters/discogsCatalog/discogsRoutes.ts` — for `getRelease`, `getMasterRelease`, `getMasterReleaseVersions`: resolves the credential once via `resolveCatalogCredential`, passes it straight to the corresponding port method (same direct route→adapter call shape as today, just with one extra resolved argument).
- `application/discogsCatalog/searchCatalogWithRatings.ts` — resolves the credential once per `searchCatalogWithRatings` invocation and threads the *same* `CatalogCredential` value into its own `searchCatalog` call and every internal `getMasterRelease`/`getReleaseRating` enrichment call (no per-item re-resolution — see research.md Decision 3's Performance rationale).
- `getArtist` — no current route consumer (confirmed by inspection: not wired to any Express route today). Signature is extended for interface completeness/future-proofing per spec's explicit inclusion of "artista" in scope, but no new route is introduced by this feature (YAGNI — out of scope to build a route that doesn't exist yet).

## Explicitly out of this contract's surface

- No change to `Release`/`Artist`/`MasterRelease`/`MasterReleaseVersionsPage`/`CommunityRating`/`CatalogSearchResponse` shapes.
- No change to `SearchCatalogOptions`.
- No new port method.
