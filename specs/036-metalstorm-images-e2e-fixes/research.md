# Phase 0 Research: Metal Storm Dashboard Images & E2E Suite Stabilization

All Technical Context fields were resolvable from the existing codebase and
live investigation — no `NEEDS CLARIFICATION` markers remain. This document
records the decisions made while translating spec.md's requirements into a
concrete technical approach.

## 1. Metal Storm image root cause: `data-image-url`, not Media RSS

**Decision**: Extend `extractImageUrl` (`backend/src/feeds/feedMapper.ts`)
with a third extraction tier that matches `<a class="ms-link" ...
data-image-url="...">` inside the item's HTML content and resolves the
captured (relative) path to an absolute URL against the source's
`feedUrl`, validated by the existing `SAFE_IMAGE_URL_PATTERN`.

**Rationale**: The originating brief's hypothesis — that Metal Storm uses
the Media RSS extension (`media:content`/`media:thumbnail`) and the parser
just isn't configured with `customFields` to expose it — was checked
against all 5 live Metal Storm feeds and **refuted**: none contain
`<enclosure>`, `media:content`, `media:thumbnail`, or `<img>` tags anywhere.
Only the News feed (`https://metalstorm.net/rss/news.xml`) carries any
image reference, and it's a non-standard `data-image-url` attribute on
`<a class="ms-link">` anchors inside the item's description (which
`rss-parser` already exposes as `item.content` — confirmed against
`rss-parser`'s own field mapping, no parser configuration change needed).
The other four Metal Storm categories (reviews, interviews, articles, staff
picks) have zero image markup of any kind in their raw feeds — for those,
continuing to show the placeholder is correct, not a residual bug.

**Alternatives considered**: Configuring `rss-parser`'s `customFields` for
Media RSS tags (rejected — the hypothesis that motivated it doesn't hold
against the live feeds; would add a code path that never matches real
Metal Storm data); scraping Metal Storm's website directly for images
(rejected — far exceeds this fix's scope, introduces a new external
dependency and failure mode, not needed when the RSS feed already carries
the data in a slightly non-standard place).

## 2. Which `ms-link` anchor to use when an item has more than one

**Decision**: Take the **first** `ms-link` match in the item's content,
consistent with the existing `<img src>` tier's "first match wins"
convention.

**Rationale**: Live feed inspection showed most Metal Storm news items
contain multiple `ms-link` anchors — the first is consistently the band
photo (`/images/bands/<id>.jpg`), later ones are album cover photos
(`/images/albums/<n>/<id>.jpg`). Both are legitimate "the feed provided an
image" outcomes for spec.md's FR-001; picking the first keeps the
extraction logic uniform with the existing tiers and avoids adding a
second, more complex heuristic (e.g., preferring an album cover over a band
photo) that the spec does not call for.

**Alternatives considered**: Preferring the last match, or specifically the
album-cover pattern over the band-photo pattern (rejected — no user-facing
requirement distinguishes them, and picking a specific one over the
positional "first" convention would be an unrequested, unverifiable design
choice).

## 3. Relative-path resolution: Node's built-in `URL`, with a protocol-relative guard

**Decision**: Resolve the captured relative path with
`new URL(relativePath, source.feedUrl).toString()`, then re-validate the
result against the existing `SAFE_IMAGE_URL_PATTERN` before returning it.
Explicitly reject values starting with `//` (protocol-relative) before
resolution, since `new URL('//evil.com/x', base)` would otherwise resolve
to `https://evil.com/x` — escaping the source's own host — and Metal
Storm's real data is always an absolute path (`/images/...`), never
protocol-relative.

**Rationale**: No URL-joining utility exists anywhere in the codebase
(confirmed by search); Node's built-in `URL` constructor is the standard,
dependency-free way to do this and was verified live to correctly resolve
`/images/bands/9141.jpg` against `https://metalstorm.net/rss/news.xml` to
`https://metalstorm.net/images/bands/9141.jpg`. `FeedSourceConfig.feedUrl`
is already in scope at the call site (`mapFeedItem(item, source)` already
receives `source`), so no new field or plumbing is needed — only passing
`source` one level deeper into `extractImageUrl`. The protocol-relative
guard is a small, cheap hardening step consistent with the existing
`SAFE_IMAGE_URL_PATTERN` guard's intent (only trust http(s) URLs the source
itself unambiguously provides).

**Alternatives considered**: Skipping the protocol-relative guard and
relying solely on `SAFE_IMAGE_URL_PATTERN` post-resolution (rejected —
`new URL()` already turns `//evil.com/x` into a valid `https://` URL that
would pass that pattern, silently trusting an arbitrary host never actually
sent by Metal Storm); storing a separate `baseUrl` field on
`FeedSourceConfig` (rejected — `feedUrl` alone is sufficient input to
`new URL()`'s base parameter, an extra field would be unused duplication).

## 4. E2E Cluster A (2 tests): stale "Dashboard" heading assertion

**Decision**: Replace `getByRole('heading', { name: /dashboard/i })` in
`sign-in.spec.ts` and `returning-session.spec.ts` with an assertion against
content the current, authenticated Dashboard actually renders (e.g. the
feed grid or its skeleton, already used as a stable target elsewhere in the
suite, such as `dashboard-feed-grid.spec.ts`'s `getByTestId('feed-article-grid')`).

**Rationale**: `DashboardPage.tsx` has rendered `FeedSourceStatusBanner` +
the news grid directly (no heading) since features 024/025/033; the
"Dashboard" heading assertion is a leftover from when the Dashboard was an
empty placeholder (feature 007) and no longer reflects the UI. This is a
test-only fix per spec.md FR-006/FR-007 — no application behavior changes.

**Alternatives considered**: Adding a "Dashboard" heading back to the UI
just to satisfy the old test (rejected — spec.md FR-012 explicitly
forbids changing app behavior to satisfy a stale test expectation; there is
no user-facing need for that heading today).

## 5. E2E Cluster B (5 tests): ambiguous `getByText('Stockholm')`

**Decision**: Replace `getByText('Stockholm')` with a role-scoped locator
for the release title specifically (e.g. `getByRole('heading', { name:
'Stockholm' })`), at all 5 call sites in `record-detail-inline-edit.spec.ts`.

**Rationale**: The test's fixture sets the record's notes field to
`'Recorded at Stockholm Sound Studio.'`, so a plain text locator for
"Stockholm" now matches both the release-title `<h3>` and that notes
paragraph, tripping Playwright's strict-mode violation. Scoping to the
heading role resolves the ambiguity without touching the fixture text or
any application code — the exact same technique already applied
successfully to the equivalent ambiguity in `release-detail.spec.ts` and
`record-detail-responsive.spec.ts` during a prior feature.

**Alternatives considered**: Renaming the fixture's notes text to remove
the word "Stockholm" (rejected — role-scoping is more robust long-term,
since it doesn't depend on fixture authors remembering to avoid a specific
substring in future edits, and matches the precedent already set
elsewhere in the suite).

## 6. E2E Cluster C (1 test): stale fixture, not a locator or timing issue

**Decision**: Add `identifiers: []` to the `release` object built by
`caching-navigation.spec.ts`'s `buildEntry()` fixture. As a low-cost,
optional defense-in-depth improvement while the file is open, also guard
`ReleaseAdditionalInfoSection.tsx`'s `identifiers.length > 0` check with
`(identifiers ?? []).length > 0`.

**Rationale**: Live reproduction showed this is neither Cluster B's locator
ambiguity (the library-list "Stockholm" click target has no competing
"Stockholm" text on that page) nor a genuine rendering-performance issue.
It's a real crash: the test's mocked API response omits `identifiers`
entirely; `ReleaseAdditionalInfoSection`'s prop type declares it
non-optional and calls `.length` on it unconditionally, throwing during
render with no error boundary in the tree — which unmounts the whole app,
so the awaited "Your copy" heading never appears within the test's
timeout. The real backend (`discogsMapper.ts`) always normalizes
`identifiers` to at least `[]`, so this fixture gap can't happen against
the real API — it's specifically a test-fixture/contract mismatch, which
spec.md FR-008's "if it's a real app problem, fix the app" clause does not
strictly require touching for a fixture-only cause, but the guard is cheap
and prevents any future fixture (or, in principle, a still-undiscovered
backend response shape) from repeating the same full-app crash.

**Alternatives considered**: Only adding the component guard, without
fixing the fixture (rejected — the fixture is still not representative of
what the app actually receives from a real backend response, and leaving
it unfixed would let a similarly-incomplete fixture reappear silently in a
future edit); only fixing the fixture, without the component guard
(sufficient to make the test pass, and would satisfy FR-008/FR-012 on its
own — the guard is optional hardening, not a strict requirement, and is
called out as such here rather than folded silently into "the fix").

## 7. E2E Cluster D (1 test): confirmed real layout bug — move "Sign out" into the hamburger menu

**Decision**: Remove the always-visible "Sign out" `Button` from
`AppHeader.tsx`'s header row below the `md` breakpoint, and add a "Sign
out" row to `HamburgerMenu.tsx`'s existing nav list (reusing its current
`min-h-11`, `md:`-gated modal styling verbatim).

**Rationale**: Live reproduction confirmed the exact reported symptom —
Playwright's own error output names the "Sign out" button as the element
intercepting the click on "Search" at 375px. The CSS math is conclusive:
`AppHeader.tsx`'s `grid-cols-[1fr_auto_1fr]` layout gives the right-hand
column roughly 103.5px at 375px (after the fixed-width search box and
grid gaps), but that column's minimum content size (hamburger 44px + gap +
"Sign out" button ≈140px) exceeds it by ~35-40px — a `1fr` track's
implicit minimum is its content's min-content size, not zero, so the
overflow spills left into the search box/hamburger instead of shrinking,
exactly matching the observed pointer-interception. This was very likely
introduced by a prior feature's 44×44px touch-target work, which enlarged
every header control simultaneously but only gave `HeaderNavIcons` and
`HamburgerMenu` (not "Sign out") a responsive `md:`-gated treatment.
Moving "Sign out" into `HamburgerMenu`'s already-existing, already-tested
nav list is the smallest fix that removes the overflow at its source,
reuses an established pattern (no new component, no new touch-target
sizing to re-derive), and is explicitly back in scope for this feature per
spec.md (unlike a prior feature that ruled out header restructuring).

**Alternatives considered**: Shrinking "Sign out" to an icon-only button in
place (rejected — preserves current header structure but introduces a new
icon-button treatment for a control that's text-only everywhere else in
the app, without a clear existing icon precedent, and doesn't reuse an
established pattern the way relocating into the hamburger menu does);
widening the header or narrowing the search box further below `sm`
(rejected — doesn't address the root cause for the narrowest viewports the
suite already tests, and risks its own new touch-target/usability
regressions in the search field).

## 8. Versioning

**Decision**: PATCH bump both packages — `backend` `0.13.0` → `0.13.1`,
`frontend` `0.22.0` → `0.22.1` — each with a `CHANGELOG.md` entry in the
same PR, per Principle VI's "fix → PATCH" classification.

**Rationale**: Every change in this feature is a bug fix (image display,
test correctness, header layout) with no schema, contract, or
backward-compatibility break in either package.

**Alternatives considered**: None — this is a direct application of the
constitution's existing semantic-versioning classification.
