# Phase 0 Research: Music News Dashboard (RSS Feed Hub MVP)

## 1. RSS/Atom parsing library

**Decision**: Add `rss-parser` (npm) as a direct backend dependency.

**Rationale**: It handles both RSS 2.0 and Atom, exposes custom fields (needed for `media:content`/`enclosure` image extraction from Metal Injection and Metal Storm items), and avoids hand-rolling XML traversal. `fast-xml-parser` is already present transitively in `backend/node_modules` (pulled in by another dependency) but is not a declared direct dependency, so relying on it directly would be fragile against a future `npm install` that drops the transitive chain. A purpose-built feed parser is simpler and more robust than driving a generic XML parser by hand (Simplicity/YAGNI, constitution Principle III).

**Alternatives considered**: `fast-xml-parser` directly (more manual mapping code, no RSS-specific ergonomics); `xml2js` (lower-level, same manual-mapping downside).

## 2. Rendering feed content safely (spec FR-008)

**Decision**: Never render feed-provided HTML as markup. The backend extracts a plain-text excerpt (strip all tags, decode HTML entities, truncate to a fixed length) and a single image URL (from `enclosure`, `media:content`, or the first `<img src>` found in the item's HTML description) as two separate plain fields. The frontend renders the excerpt as plain text and the image via a normal `<img src>` — never `dangerouslySetInnerHTML`.

**Rationale**: Metal Injection's feed embeds full `<img>` markup, inline styles, and a "the post X appeared first on Y" boilerplate paragraph inside `<description>` (confirmed by inspecting the live feed during specification). Attempting to sanitize-and-render that HTML would require an allow-list HTML sanitizer (e.g. `sanitize-html` or DOMPurify) as a new dependency, plus curation of which source markup is worth preserving (styling, boilerplate links) — none of which adds user value. Stripping to plain text + one extracted image structurally eliminates the injection surface (no parser/sanitizer bugs to worry about) and is simpler (Principle III). This satisfies FR-008 by construction rather than by an allow-list.

**Alternatives considered**: `sanitize-html` (Node) or DOMPurify (browser) allow-list sanitization — rejected as unneeded complexity for a feed teaser card that never shows full article bodies anyway (spec Assumptions: full article always lives on the source's site).

## 3. Metal Storm feed reachability (Cloudflare bot-detection)

**Decision**: Metal Storm is implemented as a best-effort source behind the same fetch/timeout/failure boundary as every other source (FR-007), not a special case. If server-side requests to `metalstorm.net` continue returning Cloudflare's challenge response (confirmed 403 with `cf-mitigated: challenge` header during specification, for both the feed-listing page and a direct feed URL request), the aggregator logs a `feed_unavailable` outcome and simply omits Metal Storm's categories from the response — the Dashboard ships and works with Metal Injection only, per the Clarifications session's resolved answer.

**Rationale**: Cloudflare's managed challenge requires JS execution / browser fingerprinting to pass, which cannot be solved by a plain server-side HTTP client without headless-browser infrastructure — out of proportion for an MVP news widget, and the clarified requirement explicitly accepts shipping without Metal Storm rather than blocking on this. No anti-bot bypass work is undertaken.

**Alternatives considered**: Headless-browser fetch (Puppeteer/Playwright) to render past the challenge — rejected: heavy new infra (violates Principle III), uncertain reliability, and not required given the clarified graceful-degradation answer. Revisit only if Metal Storm later exposes a challenge-free feed endpoint or an official API.

**Follow-up for implementation**: Because Metal Storm's exact sub-feed URLs and category labels could not be enumerated (the listing page itself is challenge-protected), the first implementation task for Metal Storm must attempt to fetch `https://metalstorm.net/home/rss.php` and, if reachable at implementation time from the deploy environment, parse the page for individual feed links; if still blocked, the source configuration ships with `enabled: false` for Metal Storm and only Metal Injection is wired live, leaving Metal Storm's config entries stubbed for a fast-follow increment.

## 4. Refresh cadence / cache TTL

**Decision**: 20-minute Redis TTL per feed source, using the existing `withCache` cache-aside helper (same helper Discogs search results use with a 30-minute TTL).

**Rationale**: Falls inside the spec's assumed 15-60 minute freshness window; reuses proven infrastructure (no new caching mechanism); a shared (non-personalized) cache key means the fetch cost is amortized across all users regardless of traffic.

**Alternatives considered**: A scheduled background refresh job — rejected: no job scheduler exists elsewhere in this codebase, and lazy cache-aside already satisfies the freshness requirement with far less operational surface (Principle III).

## 5. Category derivation

**Decision**: Category is a property of the configured `FeedSource`, not inferred per-article. Metal Injection's single feed maps entirely to a `News` category. Each of Metal Storm's discoverable sub-feeds maps to its own category (e.g. `Reviews`, `Interviews`, `Tour Dates`) as published by the source.

**Rationale**: Metal Injection's feed items carry inconsistent, mostly band-name tags (`<category>` values observed: "Latest News", "New Music", "Tour Dates", plus dozens of one-off band names) rather than a clean content-type taxonomy — inferring category per-item from these tags would be unreliable. Source-level mapping is simple, deterministic, and testable (Principle III/IV).

**Alternatives considered**: Per-item category inference via tag heuristics — rejected as unreliable given the observed tag noise, and unnecessary complexity for an MVP.

## 6. Logging outcomes

**Decision**: Extend the existing `LogOutcome` union (`backend/src/config/logger.ts`) with `feed_fetch_failed` and `feed_unavailable` (or reuse `unavailable`/`cache_hit`/`cache_miss` where they already fit — `cache_hit`/`cache_miss` apply unchanged since `withCache` is reused as-is).

**Rationale**: Matches the existing per-feature convention of adding narrowly-scoped outcome literals (e.g. feature 017's `omitted`) rather than a generic catch-all, keeping logs greppable (Principle V).
