# Phase 0 Research: Discogs Catalog Client & Data Model

## Note on sourcing

The official documentation at `https://www.discogs.com/developers/` sits
behind a Cloudflare bot challenge that blocks both direct fetches and
read-through proxies (confirmed during `/speckit-specify`: raw `curl` and a
reader-mode proxy both returned either a 403/"Just a moment…" challenge page
or only the top-level getting-started content, never the per-resource
parameter tables). To get authoritative, current answers instead of relying
on possibly-stale summaries, the facts below marked "verified empirically"
were confirmed by calling the real, public, unauthenticated
`api.discogs.com` endpoints directly (well within the unauthenticated rate
limit) and inspecting the actual JSON responses and headers.

## 1. HTTP client library

**Decision**: `axios`.

**Rationale**: This client has several cross-cutting concerns that axios
handles cleanly via one configured instance: a default `baseURL`, default
`User-Agent` and `Authorization` headers on every request, response
interceptors to classify Discogs' error responses (404 → not-found, 429 →
rate-limited, 5xx/network → unavailable) in one place, and built-in request
timeouts. That removes the boilerplate a hand-rolled `fetch` wrapper would
need to reimplement for the same behavior, and axios has first-class support
in `nock` (the chosen test-mocking library) and wide TypeScript usage
precedent.

**Alternatives considered**:
- **Native `fetch` (built into Node 20)** — zero extra dependency, which is
  attractive under Principle III (Simplicity/YAGNI). Rejected as the
  *primary* choice only because it would need a hand-written wrapper to get
  the same header-injection/error-classification behavior axios gives for
  free; for a client with several distinct error cases to classify (FR-006,
  FR-007, FR-009), that wrapper would end up re-implementing a slice of what
  axios interceptors already provide. Revisit if a future audit finds axios
  underused.
- **`got`** — powerful, but its current major versions are ESM-only, while
  this backend project is CommonJS (`"type": "commonjs"`, per feature 001).
  Adopting it would require dynamic `import()` gymnastics for no functional
  benefit here — rejected as needless complexity.

## 2. Response validation

**Decision**: `zod`, used only to validate the specific fields this feature
actually maps (not Discogs' entire response shape).

**Rationale**: Discogs is a large, crowd-sourced, decades-old public catalog;
individual records are known to have quirks (missing images, empty
tracklists, absent `real_name`). Validating the shape at the HTTP boundary —
rather than trusting `as SomeType` casts — makes FR-010 ("tolerate missing
optional fields without failing the whole mapping") an explicit, testable
contract instead of an implicit hope, and gives a clear, loggable
`DiscogsValidationError` if Discogs ever changes a field's shape outright
(distinct from a mapping bug in our own code).

**Alternatives considered**: Plain TypeScript interfaces with unchecked type
assertions (rejected — type assertions are compile-time only and silently
lie at runtime, which is exactly the failure mode FR-010 and FR-009 guard
against). A heavier schema/ORM-style library (rejected — YAGNI; zod is
already lightweight and sufficient for boundary validation only).

## 3. Authentication

**Decision**: A single Discogs **Personal Access Token**, sent as
`Authorization: Discogs token=<DISCOGS_TOKEN>`, configured via a
`DISCOGS_TOKEN` environment variable.

**Rationale**: Verified empirically that authenticated requests get a higher
rate limit (60/min) than unauthenticated ones (25/min, confirmed via the
`X-Discogs-Ratelimit` response header on a live call). Per the spec's
Assumptions, this is a single, application-level credential (not
per-end-user), and a Personal Access Token is the simplest form of that —
generated once from a Discogs account's Settings → Developers page, no OAuth
handshake required. Consumer Key/Secret (the alternative Discogs offers) is
designed for apps that need *each end user* to grant access to *their own*
Discogs account (e.g., to sync their personal wantlist) — not needed here,
since this feature only reads Discogs' public catalog on Vinylmania's
behalf.

**Alternatives considered**: Consumer Key/Secret + per-user OAuth (rejected
— solves a problem this feature doesn't have; would be revisited if a future
feature needs to read/write an individual user's own Discogs account data).
Unauthenticated requests (rejected — needlessly caps the whole app at 25
req/min shared across every collector using search at once).

## 4. User-Agent format

**Decision**: `Vinylmania/<version> +https://github.com/fortizfe/vinylmania`,
matching Discogs' documented recommendation (an RFC 1945-style
`Product/Version` token followed by a contact/reference URL, confirmed via
the official docs' own example format: `AwesomeDiscogsBrowser/0.1
+http://adb.example.com`).

**Rationale**: FR-005 requires the system to identify itself distinctly;
Discogs' own docs note that requests without a proper `User-Agent` can
receive empty/degraded responses. A static, versioned string set once in the
axios instance config satisfies this with no ongoing maintenance.

## 5. Rate-limit handling & retries

**Decision**: No automatic retry/backoff. On a `429` response, the client
throws a distinct `DiscogsRateLimitError` (carrying the
`X-Discogs-Ratelimit-Remaining`/reset info from the response headers when
present) and lets the caller decide whether/when to retry. Every response
(success or failure) logs the rate-limit headers so approaching-the-limit
situations are visible before they start failing.

**Rationale**: Per FR-006, the requirement is to surface a clear, distinct
outcome — not to guarantee eventual success via retries. Building in
automatic retries (e.g., via `axios-retry`) would add a dependency and
hidden timing behavior (retry storms under sustained load) without a
corresponding requirement asking for it — a straightforward YAGNI call.
Revisit if real usage shows callers repeatedly reimplementing their own
retry loop.

**Alternatives considered**: `axios-retry` with exponential backoff
(rejected for now per the above; the module's error type makes adding this
later, if needed, a non-breaking internal change).

## 6. Error taxonomy

**Decision**: Four internal error classes exported from
`discogsErrors.ts`: `DiscogsNotFoundError`, `DiscogsRateLimitError`,
`DiscogsUnavailableError` (network failure or 5xx), and
`DiscogsValidationError` (response didn't match the expected shape). All
extend a common `DiscogsError` base so callers can catch broadly or
narrowly.

**Rationale**: Directly satisfies FR-007 (not-found is a distinct, expected
outcome) and FR-009 (internal detail in logs, safe/generic detail to
callers) without leaking Discogs' HTTP status codes into calling code —
matching Principle IV (callers depend on an abstraction, not on `axios`'s
`AxiosError` shape).

## 7. Search endpoint scope

**Decision**: Implement only `q` (free-text query) and `type`
(`release` | `artist`) as search parameters, per the spec's Assumption that
deep filtering (genre/year/label/etc.) is out of scope for this version.
Verified empirically that `GET https://api.discogs.com/database/search?q=<q>&type=release`
and `...&type=artist` both work as expected and return a `results[]` array
plus a `pagination` object (`page`, `pages`, `items`, `per_page`, `urls`).

**Rationale**: Matches exactly what User Story 1 requires; avoids building
and testing a large parameter surface (genre, style, country, year, format,
catno, barcode, submitter, contributor, etc.) that nothing in this feature's
scope currently needs (YAGNI). Confirmed both `type=release` and
`type=artist` results carry a `resource_url` pointing at the corresponding
detail endpoint, so a search result can be turned into a detail fetch
without extra lookups.

## 8. Testing strategy

**Decision**: Three test layers, matching feature 001's precedent of
preferring real behavior over mocks wherever practically possible:
- **Unit** (`tests/unit/discogsMapper.test.ts`): pure mapping-function
  tests (multi-artist releases, alias handling, missing optional fields) —
  no HTTP at all.
- **Contract** (`tests/contract/discogsClient.contract.test.ts`): `nock`
  intercepts HTTP at the Node level, so these tests are deterministic,
  offline, and cover every classified outcome (200, 404, 429, 5xx, network
  error) without depending on Discogs' real state or rate limit.
- **Live integration** (`tests/integration/discogsClient.live.test.ts`): a
  handful of tests that call the *real* `api.discogs.com` for permanent,
  stable IDs (artist `1` — "The Persuader", release `1` — verified to exist
  and be stable during this session's research) to catch any drift between
  our mocked assumptions and Discogs' actual current behavior. Kept
  deliberately small to respect the real rate limit and avoid CI flakiness
  from network conditions; contract tests carry the bulk of the coverage.

**Rationale**: Discogs has no local emulator (unlike Firebase), so "call the
real, stable, public endpoint" is the closest equivalent to the emulator
pattern already established in this project, while `nock` keeps the fast,
deterministic majority of the suite independent of network/rate limits.

## Verified-empirically reference data (for `data-model.md` and implementation)

- Base URL: `https://api.discogs.com`
- Rate limits: 60 req/min authenticated, 25 req/min unauthenticated (a
  moving 60-second window); every response carries `X-Discogs-Ratelimit`,
  `X-Discogs-Ratelimit-Used`, `X-Discogs-Ratelimit-Remaining` headers.
- `GET /artists/{id}` response fields observed: `id`, `name`, `realname`,
  `profile`, `images[]` (`type`, `uri`, `uri150`, `width`, `height`),
  `urls[]`, `namevariations[]`, `aliases[]` (`id`, `name`,
  `resource_url`), `releases_url`.
- `GET /releases/{id}` response fields observed: `id`, `title`, `year`,
  `country`, `released`, `artists[]` (`id`, `name`, `anv`, `join`, `role`),
  `labels[]` (`id`, `name`, `catno`), `formats[]` (`name`, `qty`,
  `descriptions[]`), `genres[]`, `styles[]`, `tracklist[]` (`position`,
  `type_`, `title`, `duration`), `images[]`, `master_id`, `master_url`,
  `uri`, `community` (ratings/have/want — not mapped in this version).
- `GET /database/search?q=...&type=release|artist` response: `pagination`
  object + `results[]`, each with `id`, `type`, `title`, `thumb`,
  `cover_image`, `resource_url`, and (for releases) `year`, `format[]`,
  `label[]`, `genre[]`, `style[]`, `country`, `catno`, `master_id`.

## Outstanding NEEDS CLARIFICATION

None. All Technical Context unknowns are resolved above.
