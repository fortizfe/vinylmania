# Research: Fix CodeQL Code Quality Gate Alerts

**Feature**: `056-fix-codeql-quality-alerts` | **Date**: 2026-07-19

This feature has no NEEDS CLARIFICATION items left in Technical Context — both the docs/ exclusion mechanism and the rate-limiting tiering strategy were already resolved during `/speckit-clarify` (see spec.md § Clarifications). This document records the concrete technical decisions needed to implement those resolved choices, plus the analysis of the other four alert categories from the current CodeQL report.

## 1. Gate's actual pass/fail condition

**Finding**: `.github/workflows/ci.yml`'s `code-quality` job (added in `055-ci-codeql-node-upgrade`) only fails the job — and therefore only blocks the 4 deploy jobs via `needs` — on alerts where `rule.security_severity_level` is `critical` or `high` (see the "Fail on Critical/High CodeQL alerts" step). Of the 25 open alerts in the current report, 21 carry `security_severity_level: high` (17 `missing-rate-limiting`, 2 `feedMapper.ts` sanitization findings, 2 `incomplete-url-substring-sanitization` test findings). The remaining 4 (2 `unused-local-variable`, 1 `useless-assignment-to-local`, 1 `missing-origin-check`) have no `security_severity_level` or a `medium` one and do **not**, by themselves, block the gate.

**Decision**: Fix all 25 anyway, per the user's explicit request and spec FR-004/FR-005/SC-002 — the gate technically only needs the 21 high-severity findings resolved to go green, but "all alerts" was asked for and the 4 remaining ones are trivial cleanups with no reason to leave as legacy debt.

**Rationale**: Matches spec scope exactly; avoids a confusing state where the gate is green but the Security tab still lists 4 open findings.

## 2. Rate limiting: mechanism

**Finding**: `backend/vercel.json` rewrites all routes to a single serverless function (`/api/index.ts`). On Vercel serverless, function instances are ephemeral and can run concurrently across multiple isolates, so an in-memory counter (the default store for most rate-limiting middleware, including `express-rate-limit`'s built-in `MemoryStore`) would not enforce a consistent limit — each cold isolate gets its own counter.

**Finding**: The backend already depends on `ioredis` and has a working, optional Redis client at `backend/src/adapters/cache/redisClient.ts` (`getRedisClient()`), used by the existing `CachePort`/cache adapter. It is optional by design: `REDIS_URL` unset ⇒ `getRedisClient()` returns `null`, and the existing cache adapter degrades gracefully (logs `cache_unavailable`, falls back to calling through) rather than failing requests.

**Decision**: Implement rate limiting as a fixed-window counter directly against the existing Redis client (`INCR` + `EXPIRE` on a `ratelimit:{tier}:{ip}:{windowStart}` key), with **no new npm dependency**. Expose it through a new port (`RateLimiterPort`) and adapter, mirroring the existing `CachePort`/cache-adapter pair exactly — same directory shape (`backend/src/ports/rateLimit/rateLimiterPort.ts`, `backend/src/adapters/rateLimit/`), same fail-soft contract (a Redis outage or missing `REDIS_URL` logs a warning and **allows** the request rather than rejecting it).

**Rationale**:
- Avoids a new dependency for a two-Redis-command algorithm (Principle III: Simplicity, YAGNI & KISS) — `express-rate-limit` plus a Redis store adapter would pull in two packages to do what `INCR`/`EXPIRE` already do.
- Reuses the existing Redis connection and its established optional/fail-soft convention instead of inventing a second one (Principle IV: SOLID / DRY; Principle VIII: Adapters layer already owns infra access).
- Fail-open on Redis outage matches the existing cache adapter's precedent and Principle VII's "degrade gracefully, don't fail the whole feature" pattern — a Redis blip must not take down login or the library API, and rate limiting is defense-in-depth on top of `requireAuth`/token validation, not the only control.
- Because Redis is genuinely optional in this codebase (local dev without `REDIS_URL` is a supported, tested configuration — see `discogsRateLimitSmoothing` tests using `ioredis-mock`), any rate-limiter implementation that hard-fails without Redis would break local development and existing tests.

**Alternatives considered**:
- `express-rate-limit` + `rate-limit-redis`: rejected — two extra dependencies for logic simpler than the glue code needed to wire them to the existing optional client and fail-soft convention.
- `rate-limiter-flexible`: rejected for the same reason; also its Redis-backed limiters throw/reject on Redis errors by default, which is the opposite of this codebase's established fail-soft pattern and would need to be overridden anyway.
- In-memory (`Map`-based) limiter: rejected — unreliable on Vercel serverless per the finding above; would pass locally and quietly not rate-limit in production.

## 3. Rate limiting: tiers and thresholds

**Decision** (tiering already resolved in clarification): two tiers, both keyed by client IP (`req.ip`) — simplest single key that works whether or not the caller is authenticated yet (the Google/Discogs OAuth entry points have no `req.auth` before they run).

| Tier | Applies to | Threshold |
|---|---|---|
| `strict` | `POST /api/auth/google/complete`, `GET /api/auth/google/authorize`, `POST /api/discogs/oauth/request`, `POST /api/discogs/oauth/complete` | 10 requests / 60s per IP |
| `standard` | `authRouter` (`/session`, `/preferences`, `/me`), `libraryRouter` (all 5 flagged routes), `feedsRouter` (`/dashboard`, the second flagged route), `discogsOauthRouter`'s remaining flagged routes (`/connection`, `/status`), `discogsRouter` (catalog: `/search` + 3 flagged routes) | 100 requests / 60s per IP |

**Rationale**: Login/OAuth-exchange endpoints are the classic brute-force/credential-stuffing target (matches the clarification's stated reasoning); the numeric values are a conventional, conservative starting point for each category (10/min is tight enough to stop automated credential stuffing without blocking a real user's occasional retry; 100/min is generous enough for normal UI polling/pagination against CRUD endpoints). Both are configuration values on the same middleware factory, not different code paths, so this stays within Principle III.

**Response contract**: `429` status, `Retry-After` header (seconds until window reset), JSON body `{ "error": "rate_limited", "message": "Too many requests. Please try again shortly." }` — matches the existing error-shape convention already used by every route in these files (`{ error, message }`, see `requireAuth.ts` and `authRoutes.ts`).

## 4. `feedMapper.ts` sanitization defects

**Finding**: `decodeEntities` (backend/src/domain/feeds/feedMapper.ts) runs a chain of sequential `.replace()` calls: numeric character references (`&#(\d+);`) are decoded first, then named entities (`&amp;`, `&lt;`, `&gt;`, `&quot;`, `&apos;`) are decoded after. Because the numeric-reference pass runs first and can itself produce `&` characters (e.g. a feed item containing `&#38;lt;` decodes on pass 1 to `&lt;`), the later named-entity passes can then decode that intermediate output a second time (`&lt;` → `<`), reconstituting characters an attacker-controlled feed had double-encoded specifically to survive a single decode pass. This is CodeQL's `js/double-escaping` finding. Separately, `js/incomplete-multi-character-sanitization` flags that nothing prevents a `<script` fragment from surviving this same chain if split/obfuscated across the entity boundaries.

**Finding**: `cleanText()` calls `decodeEntities(stripHtml(raw))` — `stripHtml` (which removes literal `<...>` tags) runs *before* `decodeEntities`. This ordering means an entity-encoded tag (not literal `<`/`>` yet) sails through `stripHtml` untouched and only becomes real angle brackets afterward, in `decodeEntities` — i.e., tag-stripping happens too early to catch content that only turns into tags after decoding.

**Finding**: Feed titles/excerpts are rendered as plain React text (grep confirms no `dangerouslySetInnerHTML` consumes `Article.title`/`excerpt` in `frontend/src/components/FeedArticleCard.tsx`), so this is not an active XSS vector today — but CodeQL's `security-and-quality` query suite flags the sanitizer-shaped function itself as unsound, independent of how its output happens to be consumed today, and Principle VII requires untrusted feed content to be handled safely regardless of the current rendering path.

**Decision**: Fix both by (a) decoding all entities in a single pass — one regex with an alternation covering every entity form, resolved through one lookup/callback, so there is no second pass that can act on the first pass's output — and (b) reordering `cleanText` to strip tags *after* entity decoding, so a decoded tag is still subject to `stripHtml`.

**Rationale**: A single-pass decode by construction cannot double-unescape (there is no second pass), which resolves both `js/double-escaping` and `js/incomplete-multi-character-sanitization` from the same root-cause fix rather than two patches. Reordering strip-then-decode → decode-then-strip closes the gap where a decoded tag could skip sanitization entirely. This keeps the function's existing behavior (inert plain text output) but makes it correct by construction rather than by the current code's incidental rendering path, consistent with Principle VII's "aggregated content MUST be handled safely" requirement (not "MUST be safe only if the current frontend happens not to use it as HTML").

## 5. Test host-matching findings (`js/incomplete-url-substring-sanitization`)

**Finding**: `backend/tests/unit/feeds/domain/feedSources.test.ts:88` and `backend/tests/integration/feeds/feedsDashboardExpandedSources.integration.test.ts:49` both assert `FEED_SOURCES.some((s) => s.feedUrl.includes('metalblade.com')) === false` — an unanchored substring check. A `feedUrl` like `https://not-metalblade.com.attacker.test/feed` would also `.includes('metalblade.com')` and be (correctly, in that case) rejected — but the same unanchored pattern would also incorrectly flag a legitimate future source such as `https://feeds.example.com/metalblade.com-tribute-news` as if it were the excluded Metal Blade Records feed. Since the test's job is to assert a specific host is absent from configuration, an unanchored substring is the wrong tool.

**Decision**: Replace the substring check with a hostname-anchored check: parse each `feedUrl` with `new URL(...)` and compare `url.hostname === 'metalblade.com'` (or a hostname-suffix check with a leading-dot boundary if subdomains must also be excluded — not needed here since the existing assertion only ever targeted the exact `metalblade.com` host).

**Rationale**: `URL.hostname` gives an exact, unambiguous host component; equality comparison against it cannot be fooled by a lookalike domain in either direction (false accept or false reject), which is exactly the class of bug `js/incomplete-url-substring-sanitization` exists to catch.

## 6. `discogsCollectionAdapter.ts` useless assignment

**Finding**: `listAllInstances` initializes `let pages = 1;` before a `do { ... } while (page <= pages)` loop. The loop body always executes at least once and always assigns `pages = body.pagination.pages;` before the `while` condition is evaluated — so the initializer value `1` is never read.

**Decision**: Declare `let pages: number;` without an initializer (TypeScript's definite-assignment analysis already proves it is assigned before the `while` check reads it, since it's a `do...while`).

**Rationale**: Removes the flagged dead write with no behavior change; matches Principle III (no code that doesn't do anything).

## 7. Unused variable/import findings

**Finding**: `scripts/__tests__/run-with-timeout.test.js:6` has an unused `spawn` import/variable; `frontend/tests/unit/filters/CollapsibleFilterPanel.test.tsx:3` has an unused `vi` import.

**Decision**: Remove both; re-run the affected test file to confirm no other reference exists (a grep-then-remove, not a refactor).

## 8. `docs/` scan-scope exclusion mechanism

**Finding**: `github/codeql-action/init@v4` (already used in `.github/workflows/ci.yml`'s `code-quality` job) accepts a `paths-ignore` input directly — a YAML list of glob patterns — without requiring a separate CodeQL config file.

**Decision**: Add `paths-ignore: ["docs/**"]` to the existing `with:` block of the `github/codeql-action/init@v4` step. No new file.

**Rationale**: One-line addition to an existing, already-audited step; avoids introducing a second CodeQL configuration file (`codeql-config.yml`) for a single exclusion, consistent with Principle III. Scoping to `docs/**` (the whole docs folder) rather than just the one flagged file also pre-empts the same class of false-positive-adjacent finding from other non-shipped assets already living under `docs/` (e.g. `Vinylmania Logo - Final.dc.html`, also a generated design-tool export).

## 9. `missing-origin-check` alert disposition

**Finding**: The only alert in `docs/Vinylmania design brief/support.js` is `js/missing-origin-check` on a `window.addEventListener('message', ...)` handler inside a generated, minified design-tool bundle (confirmed non-shipped: `git log` shows it was added wholesale by a branding-asset commit, not authored/maintained code).

**Decision**: Covered by the `docs/**` scan-scope exclusion in §8 — no code change to the bundle itself (per clarification: hand-patching a file that gets overwritten on its next design-tool export was explicitly rejected).
