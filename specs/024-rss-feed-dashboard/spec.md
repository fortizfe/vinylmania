# Feature Specification: Music News Dashboard (RSS Feed Hub MVP)

**Feature Branch**: `024-rss-feed-dashboard`

**Created**: 2026-07-08

**Status**: Draft

**Input**: User description: "Para el siguiente incremento quiero trabajar en el primer mvp de la vista de dashboard. La idea principal de esta página es conectar varios rss feeds sobre musica, inicialmente heavy metal, y mostar categorias como noticias, análisis, etc. Los feeds con los que quiero conectar y explotar para este mvp son: https://metalinjection.net/feed y https://metalstorm.net/home/rss.php. Este segundo contiene feeds dentro de esa página, revísala y conecta con todos ellos. Diseña un primer layout moderno para agrupar los feeds y poder explotarlos desde vinylmania. Sientete libre de proponer mostrarlos con imágenes, diseños y demás que consideres interesante para el contexto de la aplicación."

## Clarifications

### Session 2026-07-08

- Q: If Metal Storm's site continues blocking automated/server-side requests (Cloudflare bot protection) by the time this MVP ships, what should happen? → A: Ship the MVP with Metal Injection only; add Metal Storm once its access constraint is resolved in a follow-up increment.
- Q: How many articles should be shown per category on the Dashboard? → A: A small curated highlight per category (e.g., top 3-5 most recent articles), magazine-teaser style.
- Q: Where should the Dashboard live in Vinylmania's navigation? → A: A new top-level navigation item (e.g., "Dashboard" or "News"), additive alongside existing Library/Search sections, not replacing the current landing page.
- **Planning-time correction (2026-07-08)**: The codebase already has a reserved authenticated route at `/app` (`DashboardPage.tsx`), currently showing an "Under construction" placeholder, and the app header's logo already links to `/app` as the de facto home for logged-in users — no separate nav-menu entry exists or is needed for it today. This MVP fills that existing placeholder rather than introducing a new route: the Dashboard requires authentication (same as every other `/app/*` route) and is reached via the existing logo/home link, not a new item in the secondary nav list. The public marketing page at `/` (`LandingPage.tsx`) is unaffected. This supersedes the "no authentication required" assumption and the "new top-level navigation item" phrasing below.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Browse the latest heavy metal news in one place (Priority: P1)

A vinyl collector opens the Dashboard in Vinylmania and immediately sees a feed of recent heavy metal articles — news, reviews, and other content — pulled from multiple external music publications, without needing to visit those sites individually.

**Why this priority**: This is the core value proposition of the feature. Without an aggregated, readable list of external content, there is no dashboard — every other capability (grouping, imagery, filtering) enhances this baseline.

**Independent Test**: Can be fully tested by navigating to the Dashboard and confirming that articles from at least Metal Injection appear with a title, source, publish date, and a link to the full article, delivering standalone value as a news aggregator even with no other feature in this spec implemented (Metal Storm is included whenever it is technically reachable, but is not required to be present at launch — see Clarifications).

**Acceptance Scenarios**:

1. **Given** the Dashboard is loaded, **When** the page finishes fetching content, **Then** the user sees a list of recent articles sourced from at least Metal Injection (plus Metal Storm when reachable), each showing a title, source name, and publish date.
2. **Given** an article is displayed on the Dashboard, **When** the user selects it, **Then** the full original article opens on the source publication's website (in a new tab), preserving attribution to the original author/outlet.
3. **Given** the Dashboard is loading content for the first time, **When** fetching is still in progress, **Then** the user sees a loading indicator instead of a blank or broken page.
4. **Given** one of the external feed sources is temporarily unavailable, **When** the Dashboard loads, **Then** the user still sees content from the remaining available source(s) along with a subtle notice that one source could not be loaded, rather than the whole page failing.

---

### User Story 2 - Understand content at a glance through categories and imagery (Priority: P2)

A collector scanning the Dashboard wants to quickly tell news apart from reviews, interviews, or tour announcements, and wants the page to feel like a modern music magazine rather than a plain text list — with cover art, band photos, or article thumbnails accompanying each entry.

**Why this priority**: Grouping and visual presentation are what turn a raw list of links into a genuinely useful, pleasant browsing experience, and were explicitly requested as differentiators for this MVP. They depend on User Story 1 already surfacing the underlying content.

**Independent Test**: Can be fully tested by confirming that articles are visually organized into labeled categories (e.g., News, Reviews, Interviews, Tours), that each category shows only a small curated highlight (top 3-5 most recent articles) rather than a full list, and that articles which include an image in their source feed display that image as a thumbnail/cover in the Dashboard layout.

**Acceptance Scenarios**:

1. **Given** the Dashboard has loaded articles from multiple sources, **When** the user views the page, **Then** articles are grouped under clearly labeled categories derived from their source feed (e.g., News, Reviews, Interviews, Tour Dates), with each category showing a curated highlight of its top 3-5 most recent articles.
2. **Given** an article's source feed includes an image, **When** the article is rendered on the Dashboard, **Then** the image is displayed alongside the article's title and summary.
3. **Given** an article's source feed does not include an image, **When** the article is rendered, **Then** a consistent, on-brand placeholder is shown instead of a broken image or empty gap.
4. **Given** a category currently has no articles (e.g., a source publishes no reviews that week), **When** the user views the Dashboard, **Then** that category is hidden or clearly marked as empty rather than shown as a confusing blank section.

---

### User Story 3 - Filter the dashboard down to one category or source (Priority: P3)

A collector who only cares about tour announcements, or who wants to see everything from one specific publication, wants to narrow the Dashboard view accordingly.

**Why this priority**: This is a convenience/refinement layer on top of the core aggregated + categorized view. It improves usability for repeat visits but the dashboard already delivers standalone value without it.

**Independent Test**: Can be fully tested by selecting a single category (or source) filter and confirming only matching articles remain visible, and that clearing the filter restores the full view.

**Acceptance Scenarios**:

1. **Given** the Dashboard shows multiple categories, **When** the user selects one category filter (e.g., "Reviews"), **Then** only articles belonging to that category are shown.
2. **Given** a category filter is active, **When** the user clears/resets the filter, **Then** the full multi-category view is restored.

---

### Edge Cases

- What happens when an external feed returns malformed or unparseable data? The Dashboard MUST skip the unparseable items (or the whole source) and continue rendering valid content from other sources, without crashing the page.
- What happens when an external feed is completely unreachable (network error, the source blocks automated requests, or times out)? The Dashboard MUST show the remaining working sources plus a non-blocking notice, and MUST NOT show a stale error state indefinitely — it should retry on a future refresh.
- How does the system handle an article whose title, summary, or image URL contains embedded HTML/script markup from the source feed? Content MUST be sanitized before display so no executable markup runs in the user's browser.
- What happens when two sources publish near-duplicate coverage of the same story? Out of scope for MVP — no de-duplication across sources is required.
- What happens when a user has a slow or intermittent connection while the Dashboard is fetching feeds? Partial results MAY appear progressively as each source resolves, but the page MUST never appear frozen without a loading indicator.
- What happens the first time a brand-new category (not previously seen) appears in a source feed? It MUST be displayed with a readable label rather than being dropped or shown as "undefined."

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST retrieve and display recent articles from the Metal Injection feed (metalinjection.net) at MVP launch, and MUST also retrieve and display articles from all content feeds published on the Metal Storm feed listing page (metalstorm.net) whenever that source is technically reachable; Metal Storm is a launch-desirable but not launch-blocking source (see Clarifications).
- **FR-002**: System MUST display, for each article, at minimum: title, source publication name, category/section, publish date, and a link to the original full article on the source's site.
- **FR-003**: System MUST display an image for each article when the source feed provides one, and MUST show a consistent placeholder graphic when no image is available.
- **FR-004**: System MUST group displayed articles into labeled categories (e.g., News, Reviews, Interviews, Tour Dates) derived from the originating feed/section, so users can visually distinguish content types at a glance.
- **FR-005**: System MUST allow users to open any article's original source page in a new browser tab/window, preserving attribution to the original publication and author.
- **FR-006**: System MUST periodically refresh feed content so the Dashboard reflects new articles without requiring a full application redeploy.
- **FR-007**: System MUST continue displaying content from unaffected sources when one configured source fails to load, and MUST surface a non-blocking indication that a source is temporarily unavailable.
- **FR-008**: System MUST sanitize all externally-sourced text and markup (titles, summaries, embedded HTML) before rendering, so no executable script content from a feed can run in the user's browser.
- **FR-009**: System MUST allow users to filter the displayed articles by category.
- **FR-010**: System MUST present the Dashboard as the content of Vinylmania's existing authenticated home route (currently a placeholder), reachable via the app's existing logo/home link, without altering the public (unauthenticated) landing page.
- **FR-011**: System MUST show a loading state while feeds are being fetched and an empty/graceful state if no articles are currently available from any source.
- **FR-012**: System MUST limit each category's display to a small curated highlight of its most recent articles (top 3-5) rather than the full available history, keeping the layout scannable and magazine-teaser style.

### Key Entities

- **Feed Source**: An external RSS feed the Dashboard connects to (e.g., Metal Injection, Metal Storm — News, Metal Storm — Reviews). Has a name, an origin publication, a source URL, and an associated category.
- **Article**: A single piece of content pulled from a Feed Source. Has a title, summary/excerpt, publish date, original article link, optional image, originating Feed Source, and a display category.
- **Category**: A logical grouping label used to organize Articles for display (e.g., News, Reviews, Interviews, Tour Dates). A Category can contain Articles from more than one Feed Source.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can view fresh heavy metal content from at least one external publication (Metal Injection, guaranteed at launch; Metal Storm included whenever reachable) on a single Vinylmania page within 3 seconds of opening the Dashboard under normal network conditions.
- **SC-002**: At least 95% of Dashboard page loads display content from all currently-healthy configured sources (i.e., failures are isolated to the actually-unavailable source, not the whole page).
- **SC-003**: Articles shown on the Dashboard are no older, on average, than the last scheduled refresh interval, so users see genuinely current content rather than a stale snapshot.
- **SC-004**: Users can visually identify an article's category (news vs. review vs. interview vs. tour date, etc.) without reading the article body, in a first-glance scan of the page.
- **SC-005**: Selecting an article and reaching the original full article on the source's website takes exactly one user action (a single click/tap).

## Assumptions

- The Dashboard reuses Vinylmania's existing authenticated home route (`/app`), replacing its current placeholder content; it requires the user to be signed in, consistent with every other `/app/*` route, and is reached via the existing header logo/home link rather than a new nav-menu entry.
- "Categories" are derived per Feed Source: Metal Storm's individual feeds (news, reviews, interviews, tours, etc.) map directly to their own category, while Metal Injection's single general feed is treated as a "News" category since its feed is not cleanly pre-split by content type. The exact set of Metal Storm sub-feeds and their category labels will be enumerated as part of technical planning, since Metal Storm's feed-listing page is protected by automated bot-detection (Cloudflare) and could not be programmatically enumerated during specification; the requirement is to connect all content feeds discoverable on that page, whatever that final set turns out to be, once that source is technically reachable.
- Metal Injection is the only source guaranteed to be present at MVP launch. Metal Storm is included from day one if its Cloudflare bot-protection can be worked around in time; otherwise it ships as a fast-follow increment once a viable fetch strategy is confirmed, per FR-001 and FR-007's graceful degradation behavior.
- Each category displays a small curated highlight only (top 3-5 most recent articles per FR-012), not a full paginated archive; browsing a source's complete history is out of scope for this MVP.
- No user personalization is in scope for this MVP: no saving, favoriting, marking-as-read, or per-user feed customization. All users see the same aggregated content.
- No cross-source de-duplication of similar/duplicate stories is required for this MVP.
- Clicking an article opens the original source's full article on the source's own website in a new tab; Vinylmania does not render/host the full article body itself (avoiding content-licensing concerns), only title/summary/image/metadata from the feed.
- A "reasonable" refresh interval (e.g., on the order of every 15–60 minutes) is acceptable for MVP freshness; there is no requirement for real-time/live-push updates.
- Only English-language content is expected from the initial two sources; no translation or localization of article content is required.
- This is scoped to heavy metal content for the MVP, matching the two named sources; adding other genres or additional feed sources is a future increment, not part of this spec.
- If a configured source actively blocks automated/server-side fetching (e.g., anti-bot protection), resolving that access constraint is a technical/planning concern; from a product perspective the source is simply omitted (per FR-001/FR-007's graceful degradation) until access is restored, rather than blocking the Dashboard's launch.
