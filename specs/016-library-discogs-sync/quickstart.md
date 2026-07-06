# Quickstart: Validating Library ⇄ Discogs Collection Sync

**Feature**: 016-library-discogs-sync

Runnable scenarios proving the feature end-to-end. Contracts: [contracts/library-sync-api.md](./contracts/library-sync-api.md). Data shapes: [data-model.md](./data-model.md).

## Prerequisites

- Node 20, local Redis (optional — feature degrades gracefully without it), Firebase emulators.
- `backend/.env`: existing feature-015 vars (`DISCOGS_CONSUMER_KEY/SECRET`, `DISCOGS_OAUTH_CALLBACK_URL`) plus `DISCOGS_OAUTH_BASE_URL` pointing at real Discogs or the local stub.
- A Vinylmania account linked to a Discogs account (Profile → Connect with Discogs), ideally one whose Discogs collection already contains a couple of records.

```bash
# Terminal 1 — backend (starts emulators per its dev script)
cd backend && npm install && npm run dev

# Terminal 2 — frontend
cd frontend && npm install && npm run dev
```

## Automated validation

```bash
cd backend && npm test        # contract (nock-stubbed collection endpoints), unit (sync/mapping/migration), integration
cd frontend && npm test       # component/unit for library gate, star rating, per-copy panel
cd e2e && npx playwright test library-discogs-sync.spec.ts record-detail-inline-edit.spec.ts
```

Expected: all green. The e2e specs run against the Discogs stub via `DISCOGS_OAUTH_BASE_URL`.

## Manual scenarios

### 1. Unlinked user is gated (Story 1 / FR-003)

1. Sign in with a Google account that has **no** Discogs link.
2. Open `/app/library`.
3. **Expect**: no records or actions; a card explaining linking is required with a CTA that navigates to the profile's Discogs connection area. API check: `GET /api/library` returns `409 discogs_not_linked`.

### 2. First sync: union merge + migration (Story 1 / FR-002, FR-010)

1. Use a user who had library entries **with notes/condition** created before this feature, linked to a Discogs account whose collection holds at least one record not in Vinylmania.
2. Open `/app/library`.
3. **Expect**: the library shows the union of both sides; on discogs.com the previously Vinylmania-only records now appear in the collection, with old notes in the Notes field and condition mapped to Media Condition (unmappable text appended to notes as `Condition: <original>`). Firestore check: those entries no longer have `condition`/`notes` fields and now carry `discogsInstanceId`; `discogsConnections/{uid}.initialLibrarySyncAt` is set.

### 3. Discogs is source of truth afterwards (Story 1, clarification #1)

1. On discogs.com, delete one record from the collection.
2. Back in Vinylmania, press the library's **Refresh** action (or wait >5 min and reload).
3. **Expect**: the record disappears from the library and is *not* re-added to Discogs.

### 4. Add propagates (Story 3 / FR-004)

1. Add a release via `/app/library/add`.
2. **Expect**: it appears in the library immediately and in the Discogs collection (Uncategorized folder) on first check.

### 5. Per-copy editing from the detail (Story 2 / FR-006–FR-008)

1. Open an owned record's detail. **Expect**: a per-copy panel showing 5-star rating, Media condition, Sleeve condition, Notes with current Discogs values.
2. Tap 4 stars → saves immediately. Pick conditions from the dropdowns (only Discogs grading values offered). Edit notes and confirm.
3. Reload the page and check the item on discogs.com. **Expect**: identical values in both places (SC-003).

### 6. Remove propagates (Story 4 / FR-005)

1. From the detail view, remove the record and confirm.
2. **Expect**: gone from the library and from the Discogs collection.

### 7. Failure visibility (FR-011, FR-012)

1. Point `DISCOGS_OAUTH_BASE_URL` at an unreachable host (or stop the stub) and try adding/editing.
2. **Expect**: a clear retryable error; the record/value is NOT shown as saved. Restore the stub, retry, succeeds.
3. Revoke Vinylmania's access on discogs.com (or make the stub return 401) and reload the library. **Expect**: "re-link your account" state pointing at the profile.

## Log checks (FR-013)

Backend logs (structured JSON) should show `librarySync` operations with outcomes like `sync_completed`, `first_sync_migrated`, `entry_added`, `entry_removed`, `discogs_auth_failed`, plus rate-limit metadata on collection calls. Grep example:

```bash
grep librarySync backend-dev.log | head
```
