# Port Contract: `DiscogsConnectionPort`

**Feature**: 046-library-hexagonal-migration | **Layer**: `ports/library/discogsConnectionPort.ts`
**Adapter**: `adapters/library/discogsConnectionAdapter.ts` (wraps `discogs/oauth/discogsOauthService.ts`, unmoved)
**Status**: Provisional — Historia 4 (parent user story) formally migrates the OAuth linking flow
and consolidates this port's final home (research.md Decision 3). This port only covers the two
functions the **library** domain actually calls today; the rest of `discogsOauthService.ts`
(`startLink`, `completeLink`, `getStatus`, `disconnect`) belongs to the OAuth linking flow, not the
library domain, and is out of this port's — and this feature's — scope.

```ts
export interface DiscogsConnectionPort {
  /** Returns null when the user has no Discogs account linked. */
  getConnection(uid: string): Promise<DiscogsConnection | null>;

  /**
   * Marks a connection's first library synchronization (union-merge + legacy
   * migration) as completed; every later sync for this user runs in mirror
   * mode. Called only when a first sync completes with zero failures.
   */
  markInitialLibrarySync(uid: string): Promise<void>;
}
```

`DiscogsConnection` is imported from `discogs/oauth/types.ts`, not redefined — see
`data-model.md`'s "Entities Owned by Other, Not-Yet-Migrated Domains."

## Preconditions / Postconditions (unchanged from today's `discogsOauthService.ts`)

- `getConnection` resolves `null` rather than rejecting when there is no linked account — the
  caller (`requireConnection` in `application/library/*`) is what turns a `null` into a thrown
  `DiscogsNotLinkedError` (`domain/library/libraryErrors.ts`).
- `markInitialLibrarySync` is idempotent-in-effect from the caller's perspective (it always sets
  `initialLibrarySyncAt` to "now"); `application/library/syncLibrary.ts` is what guarantees it's
  only called once per connection, by gating the call on `!connection.initialLibrarySyncAt`.

## Explicitly out of this port's surface

Firestore collection names (`discogsConnections`), the pending-link TTL (`PENDING_TTL_MS`), and the
OAuth 1.0a signing flow are entirely internal to `discogsOauthService.ts` and are not exposed here —
this feature does not need or gain visibility into the linking flow, only the ability to read an
already-linked connection and flag first-sync completion.
