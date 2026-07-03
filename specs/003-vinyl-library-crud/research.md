# Phase 0 Research: Vinyl Library CRUD

## 1. Firestore layout for library entries

**Decision**: `users/{uid}/libraryEntries/{entryId}` — a subcollection under
each user's existing profile document from feature 001.

**Rationale**: Ownership scoping falls directly out of the path — every
query is naturally rooted at the caller's own `req.auth.uid` (from
`requireAuth`), so there is no separate `ownerUid` field to keep in sync or
forget to filter by. Matches feature 001's existing `users/{uid}` document
and `firestore.rules` pattern (deny all direct client access; only the
Admin SDK, via the backend, reads/writes).

**Alternatives considered**: A top-level `libraryEntries` collection with an
`ownerUid` field and a composite index (rejected — adds an index to manage
and a real risk of a forgotten `where('ownerUid', '==', uid)` filter letting
one user's query see another's data; the subcollection makes that mistake
structurally impossible).

## 2. What's persisted vs. fetched live

**Decision**: Persist exactly four fields per entry: `discogsReleaseId`,
`addedAt`, `condition` (optional), `notes` (optional). Every catalog field
(title, artist, label, tracklist, images, genres, …) is fetched live via
feature 002's `getRelease()` and merged into the API response, never
written to Firestore.

**Rationale**: Directly implements spec FR-007 and the constitution's Vinyl
Data Source principle — Discogs stays the single source of truth for
catalog data, and Firestore only carries what's genuinely
collector-specific and not derivable from Discogs.

**Alternatives considered**: Storing a denormalized snapshot (title/artist/
thumbnail) alongside the reference, to make the list faster and independent
of Discogs' availability (the constitution explicitly *permits* this kind of
caching). Rejected for this version per the spec's explicit instruction not
to persist Discogs-obtainable data; captured as a documented Assumption to
revisit if real-world collection sizes make live enrichment too slow.

## 3. Enriching a page of entries without exceeding Discogs' rate limit

**Decision**: Paginate the library list (default 20 entries per page, same
page size for both backend query and frontend request), and enrich each
page's entries with **bounded concurrency** (5 concurrent `getRelease()`
calls at a time) rather than one-at-a-time or all-at-once.

**Rationale**: Discogs has no bulk "fetch many releases by ID" endpoint
(confirmed in feature 002's research) — enriching N entries always costs N
Discogs requests. Fully parallel (`Promise.all` over an entire large
library) risks bursting past the 60 req/min authenticated limit for
larger collections; fully sequential is unnecessarily slow. A small,
bounded concurrency pool keeps a 20-item page comfortably under the rate
limit (20 requests, at most 5 in flight, typically completing in a couple
of seconds) while still being meaningfully faster than one-by-one. This
also naturally caps the worst case for spec SC-002 ("a few hundred
records" — accessed page by page, not all at once).

**Alternatives considered**: An external concurrency-limiting library
(e.g. `p-limit`) — rejected as an unnecessary dependency for what a ~15-line
in-house helper (`concurrency.ts`) covers; revisit only if enrichment logic
grows materially more complex. Fetching the whole library at once (rejected
— defeats the point of pagination and risks both slow responses and rate-
limit errors for larger collections).

## 4. Per-entry Discogs failure handling

**Decision**: If `getRelease()` throws `DiscogsNotFoundError` or
`DiscogsUnavailableError` for a given entry, that entry is still included in
the response with `release: null` and `catalogStatus: 'unavailable'` — the
rest of the page's entries are unaffected. A `DiscogsRateLimitError` for one
entry is treated the same way (the burst-limiting from research §3 makes
this rare in practice, but it must never fail the whole request).

**Rationale**: Directly implements spec FR-009 and its edge case ("that
single record MUST degrade gracefully... without breaking the rest of the
list"). Distinguishing `catalogStatus` from a hard error lets the frontend
show a clear, specific "couldn't load catalog details" state per card
instead of a generic error.

**Alternatives considered**: Failing the entire list request if any single
entry's enrichment fails (rejected — directly contradicts FR-009 and would
make one bad/rate-limited Discogs ID break a collector's whole library
view).

## 5. Adding a record: validating it's a real Discogs release

**Decision**: `POST /api/library` calls `getRelease(discogsReleaseId)`
first; if it throws `DiscogsNotFoundError`, the request is rejected with a
clear "no such release" response before anything is written to Firestore.
On success, the entry is persisted and the same already-fetched `Release`
data is reused to build the response (no second Discogs call).

**Rationale**: Directly implements spec FR-010 ("no way to add a record
that isn't backed by a real Discogs release"). Reusing the fetched data for
the response avoids a redundant second call to Discogs for the same ID.

**Alternatives considered**: Trusting the `discogsReleaseId` the frontend
sends without verifying it server-side (rejected — the frontend's own
search/select flow already guarantees a real ID today, but the constitution
and FR-010 call for the backend itself to guarantee it, not merely a UI
convention that could drift).

## 6. Pagination shape

**Decision**: Simple offset-based pagination — `GET /api/library?page=1&pageSize=20`
— matching Firestore's `.offset()`/`.limit()` at this scale, with the
response including `{ page, pageSize, totalItems }`.

**Rationale**: At "a few hundred records" (spec SC-002), Firestore's offset
cost is negligible; opaque cursor-based pagination (`startAfter` tokens)
would add complexity (the frontend would need to carry an opaque token
across page loads) with no real benefit at this scale — a straightforward
YAGNI call, consistent with feature 002's choice to implement only the
search parameters the spec actually needs.

**Alternatives considered**: Cursor-based (`startAfter`) pagination
(rejected for now — more moving parts than this scale justifies; would be
revisited if collections grow into the thousands).

## 7. Frontend API-call helper

**Decision**: A new, small `frontend/src/services/apiClient.ts` exporting an
`authorizedFetch(path, options)` helper that reads the current Firebase
user's ID token and attaches it as `Authorization: Bearer <token>`. The new
`libraryApi.ts` and `discogsApi.ts` modules use it. `AuthContext.tsx`'s own
existing internal fetch calls (`establishSession`/`fetchExistingSession`)
are left exactly as they are.

**Rationale**: Avoids duplicating the "attach the current ID token" logic a
third time (SOLID/DRY) for the six new frontend-to-backend calls this
feature adds, without touching already-tested, working auth code that has
no reason to change.

**Alternatives considered**: Extending `AuthContext` itself to expose a
generic authorized-fetch method (rejected — would widen `AuthContext`'s
responsibility beyond authentication state into generic API plumbing;
keeping `apiClient.ts` separate matches Principle IV's Single Responsibility
guidance).

## 8. Search endpoint exposure

**Decision**: `GET /api/discogs/search?q=&type=` is a thin, `requireAuth`-
protected proxy directly onto feature 002's `searchCatalog()` — no new
logic, just request-param passthrough and response passthrough.

**Rationale**: Feature 002 deliberately deferred "a user-facing search
screen/endpoint" as future work; this is that work. Gating it behind
`requireAuth` (rather than leaving it open) protects the shared,
rate-limited Discogs credential from being exhausted by unauthenticated
traffic, consistent with spec FR-006's "every operation scoped to the
authenticated user" spirit even though search itself isn't
collector-specific data.

**Alternatives considered**: Leaving search unauthenticated for simplicity
(rejected — the whole app is behind Google sign-in already per feature 001;
there's no user-facing reason for search to be the one open door, and it
would let anyone burn the app's shared Discogs rate limit).

## Outstanding NEEDS CLARIFICATION

None. All Technical Context unknowns are resolved above.
