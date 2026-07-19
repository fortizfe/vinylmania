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

**Superseded decision** (kept for the record — see §2b below for why it was reversed after implementation): a hand-rolled fixed-window counter directly against `INCR`/`EXPIRE`, with no new npm dependency, exposed through a `RateLimiterPort` mirroring `CachePort`.

### 2b. Why the hand-rolled approach was reversed after implementation

**Finding** (discovered empirically after opening the PR — the `code-quality` gate still failed on the *same* 17 route lines after the hand-rolled limiter was wired in): CodeQL's `js/missing-rate-limiting` query does not infer "this code returns 429 under load" generically. Its `RateLimitedRouteHandlerExpr` model (see the [query help](https://codeql.github.com/codeql-query-help/javascript/js-missing-rate-limiting/) and [`MissingRateLimiting.qll`](https://codeql.github.com/codeql-standard-libraries/javascript/semmle/javascript/security/dataflow/MissingRateLimiting.qll/module.MissingRateLimiting.html)) only recognizes a fixed allowlist of npm packages: `express-rate-limit` (the explicitly recommended one), `express-brute`, `express-limiter`, and `rate-limiter-flexible`. A correct, custom Redis-backed limiter is invisible to the query no matter how sound it is at runtime.

**Finding**: There is also a documented false-negative (github/codeql issue #1949) where even a *recognized* library's middleware instance goes undetected if it's constructed in one module and imported into another (e.g. built once in a shared `middleware.ts` and re-exported) — the query's dataflow tracking works best when the `rateLimit(...)` call is local to the same file as the route registration it protects.

**Revised decision**: Use `express-rate-limit` directly (the package the query's own docs recommend). The `rateLimit(...)` call itself is constructed **locally in each of the 6 route files** (not imported as a pre-built middleware instance) to stay clear of the issue #1949 false-negative — only plain, non-middleware values are shared across files: `RATE_LIMIT_WINDOW_MS`/`RATE_LIMIT_THRESHOLDS`/`RATE_LIMIT_MESSAGE`/`rateLimitHandler` (a config object and a handler function, not an Express middleware) in `backend/src/adapters/rateLimit/rateLimitOptions.ts`, and a `createRateLimitStore()` factory in `backend/src/adapters/rateLimit/rateLimitStore.ts` that each file calls for its store.

### 2c. Two more empirical bugs found via the full backend suite (not via CodeQL) — both about *when* `getRedisClient()` gets called

After the `express-rate-limit` pivot fixed the gate, the full `backend` test suite (489 tests) surfaced 5 failing test files (`discogsRetryResilience.test.ts`, `librarySync.integration.test.ts`, `discogsCacheOutage.test.ts`, `feedsSourceDirect.integration.test.ts`, `discogsOauthRoutes.test.ts`) — all files that globally mock `ioredis` for their own, unrelated Redis-caching scenarios. Root-caused via a `git worktree` diff against `main` (proved the failures were branch-introduced, not pre-existing) and a temporary revert of rate limiting from one route file (proved the *route wiring* wasn't the cause — the *store's Redis-resolution timing* was):

**Bug 1 — `rate-limit-redis`'s `RedisStore` requires Lua scripting (`SCRIPT`/`EVALSHA`) for its atomic increment, and `ioredis-mock` does not implement `SCRIPT` at all.** Every test file that mocks `ioredis` and exercises a rate-limited route would throw inside the store. **Fix**: drop the `rate-limit-redis` dependency entirely; write a ~15-line custom `Store` (`RedisIncrExpireStore` in `rateLimitStore.ts`) using only `INCR`/`PEXPIRE`/`PTTL`/`DECR`/`DEL` — all supported by both real `ioredis` and `ioredis-mock`. CodeQL's recognition (§2b) is keyed off the `rateLimit(...)` call, not the store implementation, so this carries no detection risk. Net effect: one fewer dependency than originally planned.

**Bug 2 — `express-rate-limit` calls `store.init(options)` synchronously the moment `rateLimit(...)` is called**, i.e. still at route-module import time (`createApp()` in every test file runs at module top level, before that file's `beforeAll` sets `REDIS_URL`). The store wrapper's first implementation resolved its Redis-vs-in-memory delegate *inside* `init()`, so `getRedisClient()` — a globally memoized singleton shared by every Redis consumer, including the unrelated cache adapter — got called and permanently memoized "no Redis" for the rest of that test file before `beforeAll` ever ran, silently breaking caching for every other feature under test in that file. **Fix**: `init()` now only captures the `options` object; actual delegate resolution (and the `getRedisClient()` call) is deferred to the first `increment()`/`get()`/etc. call, which only happens inside an actual request — safely after `beforeAll`. A unit test (`rateLimitStore.test.ts`) now asserts `getRedisClient()` is called by neither construction nor `init()`, only by the first `increment()`.

**Lesson for future Redis-backed additions to this codebase**: `getRedisClient()`'s module-level memoization means *any* code path that touches it — construction, `init()`, or otherwise — before a consuming test's `beforeAll` runs will silently poison Redis availability for that entire test file. Store/adapter wrappers must defer their first `getRedisClient()` call to the first real operation, never to construction or setup hooks.

### 2d. A third empirical bug, found via the PR's own `e2e-test` job — the `strict` tier throttled the e2e suite's real sign-in traffic

Once the backend suite was green, the PR's `e2e-test` job (Playwright, `workers: 1`, but a **single long-lived backend process serving the entire run** — `e2e/playwright.config.ts`'s `webServer` entries, not one process per test) failed 1 test outright and flaked 10 more, all downstream of the same symptom: `signInAsFakeGoogleUser: the redirect to the Google stub authorize page never landed` — i.e. `GET /api/auth/google/authorize` returned `429` instead of the expected `302`. 139 e2e spec files call `signInAsFakeGoogleUser`, all against that one backend process, comfortably exceeding the `strict` tier's 20/60s threshold — realistic CI test volume, not the credential-stuffing pattern the tier defends against, but indistinguishable from it by IP-based counting alone.

**Fix**: `RATE_LIMIT_THRESHOLDS` in `rateLimitOptions.ts` now reads an optional `RATE_LIMIT_MAX_OVERRIDE` env var and, when set to a positive number, uses it for *both* tiers instead of the 20/100 defaults. `e2e/playwright.config.ts`'s backend `webServer` entry sets it to `100000` (effectively unlimited for one CI run's duration). Production and every other environment (dev, backend unit/integration tests) leave it unset and get the real 20/100 values. Critically, this does **not** touch CodeQL recognition (§2b/§2c): the `rateLimit(...)` call remains present, unconditionally, in every route file's source regardless of what this env var resolves to at runtime — CodeQL's static analysis never evaluates it.

**Rationale**: Principle III (Simplicity/YAGNI) is about not adding unjustified complexity — it does not override the concrete, external requirement that the specific automated gate this feature exists to satisfy can actually recognize the fix. Two dependencies that make the gate's own recognized-pattern list is a smaller cost than a correct-but-invisible implementation that leaves the gate permanently red. The fail-soft/optional-Redis behavior from the original decision is preserved (§2's rationale on Principle VII/graceful degradation still applies) — only the mechanism doing the counting changed.

**Alternatives considered** (revisited): `rate-limiter-flexible` is also CodeQL-recognized and was reconsidered, but `express-rate-limit` is the package named directly in CodeQL's own query-help example, minimizing risk of a further detection gap; it is also already the most widely adopted Express rate-limiting package, and `rate-limit-redis` is its official companion store.

## 3. Rate limiting: tiers and thresholds

**Decision** (tiering already resolved in clarification): two tiers, both keyed by client IP (`req.ip`) — simplest single key that works whether or not the caller is authenticated yet (the Google/Discogs OAuth entry points have no `req.auth` before they run).

| Tier | Applies to | Threshold |
|---|---|---|
| `strict` | `POST /api/auth/google/complete`, `GET /api/auth/google/authorize`, `POST /api/discogs/oauth/request`, `POST /api/discogs/oauth/complete` | 20 requests / 60s per IP |
| `standard` | `authRouter` (`/session`, `/preferences`, `/me`), `libraryRouter` (all 5 flagged routes), `feedsRouter` (`/dashboard`, the second flagged route), `discogsOauthRouter`'s remaining flagged routes (`/connection`, `/status`), `discogsRouter` (catalog: `/search` + 3 flagged routes) | 100 requests / 60s per IP |

**Rationale**: Login/OAuth-exchange endpoints are the classic brute-force/credential-stuffing target (matches the clarification's stated reasoning); the numeric values are a conventional, conservative starting point for each category, generous enough for normal UI polling/pagination against CRUD endpoints (`standard`) or a real user's occasional retry (`strict`) without weakening the abuse protection meaningfully. Both are configuration values on the same middleware factory, not different code paths, so this stays within Principle III.

**Revised from 10 to 20** (§2c full-suite run): the existing `discogsOauthRoutes.test.ts` contract suite legitimately calls `/request`/`/complete` 12 times across its normal test flow (all sharing one limiter instance for the file, as intended) — 10 was too tight even for non-abusive traffic. 20 keeps meaningful headroom above that file's real usage while remaining a materially tighter bound than `standard`.

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
