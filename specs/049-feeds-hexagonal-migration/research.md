# Phase 0 Research: Feeds/RSS Domain Migrated to Hexagonal Architecture

No `NEEDS CLARIFICATION` markers remained in the Technical Context. One design
question was already resolved during `/speckit-clarify` (whether the feed source
port's return type stays coupled to `rss-parser`'s own types) and is recorded in
spec.md's Clarifications section, not repeated here as an open decision — Decision 1
below documents its resulting shape, not the choice itself. The decisions below
resolve everything else spec.md explicitly deferred to this planning phase.

## Decision 1: `FeedSourcePort` returns a domain-owned `RawFeedItem[]`, built by the adapter

**Decision**: `ports/feeds/feedSourcePort.ts` declares
`fetchFeed(feedUrl: string, timeoutMs?: number): Promise<RawFeedItem[]>`, where
`RawFeedItem` is a new type in `domain/feeds/types.ts`:

```ts
export interface RawFeedItem {
  title?: string;
  link?: string;
  guid?: string;
  isoDate?: string;
  pubDate?: string;
  content?: string;
  contentSnippet?: string;
  summary?: string;
  enclosureUrl?: string;
}
```

`adapters/feeds/feedSourceAdapter.ts` (relocated from `feeds/feedClient.ts`) calls
`rss-parser`, then maps each `Parser.Item` in the result's `items` array to a
`RawFeedItem` (`enclosureUrl: item.enclosure?.url`, every other field copied by name)
before returning the plain array — never the library's own `Parser.Output` wrapper.

**Rationale**: Verified by reading `feedMapper.ts` and `feedClient.ts` before deciding:
`mapFeedItem(item: Parser.Item, ...)` and `fetchFeed(): Promise<Parser.Output<...>>`
both name `rss-parser`'s own exported types directly — the only two files in this
domain that did so. This is the same kind of boundary-crossing type coupling Historia
3's Decision 4 identified for `discogsMapper.ts` (there resolved by having the adapter
hand the mapper `unknown`/Zod-validated data instead of a named `axios` response type).
The spec's Clarifications session selected the option that mirrors that precedent most
closely: introduce a domain-owned shape at the port boundary rather than either leaving
the domain type-coupled to the parsing library (rejected option B) or moving the
mapper's pure sanitization rules into the adapter layer just to keep them next to the
type they happened to consume (rejected option A, which would misclassify business
rules — excerpt length, safe-image-URL filtering — as adapter-layer protocol
translation). `RawFeedItem`'s nine fields are exactly the `Parser.Item` fields
`feedMapper.ts` already reads (verified: `title`, `link`, `guid`, `isoDate`, `pubDate`,
`content`, `contentSnippet`, `summary`, `item.enclosure?.url`) — no field is added,
renamed, or dropped, only the type's origin changes from "whatever `rss-parser`
exports" to "this domain's own contract."

**Alternatives considered**: Passing `Parser.Item` straight through the port
unchanged (status quo) — rejected per the Clarifications session, since it leaves
`domain/feeds/feedMapper.ts` importing a 3rd-party library's named type, which
Constitution Principle VIII's dependency rule is meant to prevent even for type-only
imports (a domain file that imports `rss-parser`'s types could not, for example, be
unit-tested against a hand-built fixture without also depending on the library's type
declarations being installed). Making `RawFeedItem` a subset of only the fields
actually used today (omitting `enclosureUrl` as a separate field, inlining it into
`content` some other way) — rejected as needless indirection; the field is read once,
by name, exactly like every other field, so there is no reason to encode it
differently.

## Decision 2: `getDashboard` and `getSourceArticles` stay combined in one application-layer factory

**Decision**: `application/feeds/getFeedsDashboard.ts` exports one factory,
`createFeedsAggregationUseCase(deps: { feedSource: FeedSourcePort; cache: CachePort })`,
returning `{ getDashboard, getSourceArticles }` — both functions close over the same
private `fetchSourceArticles` helper (per-source cache-aside fetch + map, relocated
unchanged from `feedAggregator.ts`) and the same private `groupByCategory` helper
(used only by `getDashboard`).

**Rationale**: This departs from Historia 4's one-factory-per-file precedent
(`createStartLinkUseCase`, `createCompleteLinkUseCase`,
`createGetConnectionStatusUseCase`, `createDisconnectConnectionUseCase` — four
independent files, each with no shared logic between them, verified by reading all
four). Verified here that the opposite is true: `getDashboard` and `getSourceArticles`
already share `fetchSourceArticles` today (both call it, `feedAggregator.ts` defines it
once), and Constitution Principle III explicitly favors "the simplest design that
satisfies the current, stated requirement" over splitting code that has no reason to
be split. Two files each re-implementing (or importing from the other) the identical
per-source cache-aside-and-map pipeline would be either duplication or an artificial
cross-file dependency between two files that are supposed to be independently
readable — worse on both Principle III and Principle IV (Single Responsibility is about
one reason to change, not one function per file) than keeping them together.

**Alternatives considered**: Splitting into two files with `fetchSourceArticles`
promoted to a third, shared `application/feeds/` helper module — rejected; this adds a
file and an import relationship to avoid a colocation that costs nothing, the reverse
of what Historia 4's real split (four independently-testable, independently-changing
use cases) was solving for. Historia 4's own pattern is the default precedent to
follow for consistency, but it is not itself a rule requiring one-function-per-file
regardless of whether the functions share logic — verified against spec.md's own
Independent Test criteria for this feature's User Story 1, which already treats
`getDashboard`/`getSourceArticles` as one testable unit ("running
`getDashboard`/`getSourceArticles` against a fake feed source port and a fake cache").

## Decision 3: `feedSources.ts` relocates to `domain/feeds/`, unchanged, with no port

**Decision**: `feeds/feedSources.ts` moves to `domain/feeds/feedSources.ts` verbatim —
same `FEED_SOURCES` constant, same entries, no new port or adapter.

**Rationale**: Verified: the file imports only its own `FeedSourceConfig` type, no
infrastructure SDK. It is static configuration data that happens to live in code
(spec.md's own Edge Cases already called this out), not a business rule with
conditional logic — the deciding difference from `feedMapper.ts` (Decision 1), which
has real branching logic (safe-URL filtering, text sanitization) that could be
unit-tested independently of any fixture data. `feedSources.ts` has nothing to test
beyond "does this constant have the shape the type says it does," which the existing
`feedSources.test.ts` already does today and continues to do unchanged from its new
location.

**Alternatives considered**: Treating it as adapter-layer configuration since it is
"where the real feed URLs are wired up" — rejected; Constitution Principle VIII draws
the domain/adapter line at infrastructure-SDK dependency, not at "contains real-world
values." `feedSources.ts` has no infrastructure dependency to isolate, so there is
nothing for an adapter boundary to protect here.

## Decision 4: The feeds HTTP routes' existing error-mapping shape is preserved, not generalized to a shared error hierarchy

**Decision**: `adapters/feeds/feedsRoutes.ts` keeps the exact two-branch shape
`routes/feeds.ts` already has today: a 404 JSON response when
`getSourceArticles` returns `null` (unknown/disabled source id — not an error, a
domain-level "not found" result), and a 500 JSON response for anything the use case
throws. No new domain error type is introduced for this domain.

**Rationale**: Verified by reading `routes/feeds.ts`: unlike the OAuth/collection
domain (which has `DiscogsOauthFlowError` with multiple typed codes) or the catalog
domain (`DiscogsNotFoundError`/`DiscogsRateLimitError`/`DiscogsUnavailableError`), this
domain's aggregation logic never throws a domain-specific error for an expected
failure mode — a failing source is represented as data (`SourceStatus.status =
'unavailable'`), not as a thrown error, and an unknown source id is represented as
`null`, not a thrown error. The only thing that can reach the route's `catch` block is
a genuinely unexpected failure, which the existing generic 500 branch already handles
correctly. Introducing a typed error hierarchy here to "generalize" Constitution
Principle VIII's cited error-handling pattern would invent a mechanism this domain has
no failure mode to justify — Principle III's YAGNI applies directly.

**Alternatives considered**: Wrapping the not-found case in a thrown
`FeedSourceNotFoundError` to mirror the catalog/OAuth domains' typed-error style more
closely — rejected; the current `null`-return shape already cleanly separates an
expected, data-representable outcome (source not found) from a genuinely exceptional
one, and Constitution Principle VIII cites the existing error-hierarchy pattern as the
model to *generalize where errors already exist*, not as a mandate to introduce a
thrown error everywhere a domain has a non-success outcome.
