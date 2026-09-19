# Feature Specification: RSS News View Redesign & Reliable Article Images

**Feature Branch**: `067-rss-view-redesign`

**Created**: 2026-09-19

**Status**: Draft

**Input**: User description: "Quiero rediseñar la vista de rss completamente. Me gustaría que tuviera una usabilidad y utilidad mucho mayor que ahora. Lo que quiero conseguir es que la vista tenga un aporte al usuario que le permita con poca interacción ver claramente las noticias. También quisiera trabajar en un modelado genérico para cualquier origen de rss. Actualmente no somos capaces de sacar la imagen de la noticia de todos los origenes. Trabaja en un desarrollo para que se pueda sacar la imagen de cada origen. Sobre el aspecto visual, quiero que investigues otras webs de rss y me propongas 3 nuevos conceptos de UX que mejoren por completo nuestra versión actual. Yo decidiré cual de los 3 implementaremos."

Current-state findings, per-source image analysis and the three UX concepts
(A "Portada", B "Río", C "Quiosco") are in [research.md](./research.md).

## Clarifications

### Session 2026-09-19

- Q: Which UX concept should the redesigned view implement (A "Portada", B "Río" or C "Quiosco")? → A: Concept A "Portada" (front page with lead story, secondary tiles and a "Latest" list).
- Q: Which pages may the system fetch when looking up an article's preview image? → A: Public network addresses only: private, loopback, link-local and cloud-metadata addresses are refused, the check is repeated after every redirect, and only web-page (HTML) responses up to a size cap are read.
- Q: When does the article-page image lookup run and how long is its result kept? → A: During the source refresh, within the 1-second cold-load budget; each result, including "no image found", is kept per article link while the article stays in the feed, for at most 7 days.
- Q: What counts as "recent" for the all-sources view? → A: Published in the last 7 days; a source with nothing in that window is absent from the all-sources view but still reachable through its filter.
- Q: What does the view look like when a single source is selected? → A: The same Portada layout (lead, secondary tiles, "Latest" list) built from that source's articles only.
- Q: Where is a source's "unavailable" state shown? → A: On that source's filter chip, with an icon plus the text "unavailable"; the chip stays selectable and there is no banner.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Every news item shows its real image, whatever the source (Priority: P1)

A collector opens the news view and every article carries a picture: the
article's own image whenever the source publishes one anywhere (in the feed
or on the article page), and otherwise a clear, recognisable placeholder
identifying the source — never an empty grey box or a broken-image icon.
Adding a new feed source requires only its name and feed address; no
source-specific handling is ever needed to get its images.

**Why this priority**: Explicitly requested, and today 3 of 8 sources
(Heavy Metal Overload, Femme Metal, Metal Underground) show no image at all
(research.md §1.3). Images are the main visual cue for scanning news, so
every layout concept depends on them. Deliverable on its own inside the
current view.

**Independent Test**: With the current view unchanged, load the news view
and check that Heavy Metal Overload and Femme Metal articles now show their
real article images, Metal Underground articles show the source-branded
placeholder, and no article shows a blank or broken image.

**Acceptance Scenarios**:

1. **Given** a source whose items carry their image only as Media RSS content or thumbnail, **When** its articles are shown, **Then** each shows that image.
2. **Given** a source whose items carry no image in the feed but whose article pages declare a per-article preview image, **When** its articles are shown, **Then** each shows the article page's preview image.
3. **Given** a source whose article pages all declare the same image (a site logo), **When** its articles are shown, **Then** that image is not used and the source-branded placeholder is shown instead.
4. **Given** an article whose image address fails to load in the browser, **When** it is displayed, **Then** the source-branded placeholder replaces it without layout shift and without a broken-image icon.
5. **Given** a new source is added with only a name and a feed address, **When** its feed uses any of the supported image locations (research.md §1.4), **Then** its images appear with no further configuration.
6. **Given** an image address that is not an absolute http(s) address (e.g. `javascript:`, `data:`, relative path), **When** it is found in a feed or page, **Then** it is ignored.

---

### User Story 2 - Scan the latest news clearly with minimal interaction (Priority: P1)

A collector opens the news view and, without tapping anything, sees the
newest articles from all available sources in a layout with clear hierarchy
and obvious freshness, so they can decide within seconds what to open. The
layout follows concept **A "Portada"** (research.md §3): a large lead
story, 2–4 secondary tiles and a compact "Latest" list below.

**Why this priority**: The core of the request ("ver claramente las noticias
con poca interacción"). Today the view shows only 10 articles in total,
offers a useless category filter, and every card looks the same
(research.md §1.2).

**Independent Test**: Open the news view on a phone-width and a
desktop-width screen with all sources available and verify, without any
interaction, the concept's layout, that articles from every available source
are present, and that each article shows title, source, relative age and
image or placeholder.

**Acceptance Scenarios**:

1. **Given** all sources are available, **When** the view loads, **Then** articles from every source that published in the last 7 days are visible without any filter interaction, and no single source can crowd the others out.
2. **Given** the view is loaded, **When** the user looks at any article, **Then** they see its title, source name, how long ago it was published (relative: "just now", "25m ago", "3h ago", "2d ago"; from 7 days a short date such as "Sep 12") and its image or placeholder.
3. **Given** the user selects an article, **When** it opens, **Then** the original article opens on the source's site in a new tab.
4. **Given** a phone-width screen, **When** the view loads, **Then** the lead story and at least 3 further article titles are visible on the first screen, and the page never scrolls horizontally.
5. **Given** a keyboard or screen-reader user, **When** they move through the view, **Then** every article is reachable in reading order, has one accessible name (the title is not announced twice) and a visible focus indicator.
6. **Given** the newest articles include some with only a placeholder and a prolific source published several of the newest ones, **When** the view loads, **Then** the lead is the most recent article with a real image, the secondary tiles show real images from different sources while other sources have candidates, and placeholder-only articles appear only in the "Latest" list.

---

### User Story 3 - Focus on a single source in one tap (Priority: P2)

A collector who follows one outlet selects it and sees everything that
source currently publishes in the same Portada layout (lead, secondary tiles,
"Latest" list) built from that source's articles only; one more tap returns
to all sources.

**Why this priority**: Existing behaviour (spec 041) that users rely on; it
must survive the redesign, but the main view already delivers value without
it.

**Independent Test**: From the loaded view, select one source and verify
only its articles are shown in the Portada layout, including those older
than the all-sources 7-day window; select "All" and verify the full view
returns.

**Acceptance Scenarios**:

1. **Given** the view is loaded, **When** the user selects a source, **Then** only that source's articles are shown in the Portada layout (lead = its most recent article with a real image, secondary tiles and "Latest" list from the same source), including articles older than 7 days, and the selection is visibly and non-colour-only indicated.
2. **Given** a source is selected, **When** the user selects "All", **Then** the all-sources Portada view returns.
3. **Given** a source that is unavailable, **When** the user selects it, **Then** a clear "temporarily unavailable" message is shown instead of an empty list.

---

### User Story 4 - Know when a source is down without losing the rest (Priority: P3)

When one or more sources cannot be reached, the collector still sees
everything else and understands, from the source filter itself and without
any banner, which sources are missing.

**Why this priority**: Required by Principle VII and already covered today;
the redesign only has to keep it, now shown on the source filter chips.

**Independent Test**: Make one source fail and verify the remaining
articles render normally and the failing source is identified as
unavailable on its filter chip.

**Acceptance Scenarios**:

1. **Given** one source fails or times out, **When** the view loads, **Then** all other sources' articles are shown, the failing source's filter chip shows an icon plus the text "unavailable" (not colour alone), the chip stays selectable (US3 scenario 3), and no banner is shown.
2. **Given** every source fails, **When** the view loads, **Then** a single friendly empty state explains news is temporarily unavailable.

---

### Edge Cases

- **Feed item with several images** (e.g. Media RSS group with sizes): the largest suitable image is used; a tiny tracking pixel or icon is not used when a larger image exists.
- **Feed without any image and article page without a per-article image**: source-branded placeholder (Metal Underground today).
- **Article link pointing to a private or internal network address** (directly or via redirect): no page lookup is made; the placeholder is shown.
- **Slow article page when looking up an image**: the lookup gives up within a bounded time and the placeholder is used; the item and the rest of the view are never delayed beyond SC-005.
- **Broken or blocked image URL at display time**: placeholder, no broken-image icon, no layout shift.
- **Duplicated items** (same link or same identifier appearing twice in one feed or across refreshes): shown once.
- **Very long titles**: truncated to the concept's line limit with an ellipsis; the full title remains available to assistive technology and as the link's accessible name.
- **Title or excerpt containing HTML or encoded entities**: shown as plain text, never rendered as markup (existing FR-008 of spec 024 still holds).
- **Item with missing or unparseable date**: placed as if published at fetch time, as today.
- **Source with nothing published in the last 7 days**: absent from the all-sources view, still listed in the source filter and fully reachable through it.
- **Source that publishes 100 items per feed** (Heavy Mag): cannot push other sources out of the all-sources view (FR-010).
- **No items at all** (all sources healthy but empty): friendly "No news right now" empty state.
- **All sources failing**: single "temporarily unavailable" empty state (US4).
- **Reduced motion / reduced transparency / increased contrast preferences**: honoured; the view is fully usable with motion off.

## Requirements *(mandatory)*

### Functional Requirements

**Generic source model & images**

- **FR-001**: A feed source MUST be fully defined by its display name and feed address (plus the existing enabled/priority flags); no per-source code or per-source image rules are allowed.
- **FR-002**: The system MUST support RSS 2.0 and Atom feeds.
- **FR-003**: For each article, the system MUST look for its image in this order and stop at the first usable one: image enclosure; Media RSS content (including grouped content); Media RSS thumbnail; podcast-style item image; first image embedded in the item's full content; first image embedded in the item's description/summary; the article page's declared social preview image.
- **FR-004**: The article-page lookup (last step of FR-003) MUST only run for articles that found no image in the feed, during the source refresh, bounded in time per article and in number of lookups per source refresh so the cold-load budget of SC-005 holds. Each lookup result, including "no image found", MUST be kept per article link while the article stays in its source's feed, for at most 7 days, so each article page is fetched at most once in that period.
- **FR-004a**: The article-page lookup MUST only contact public network addresses: private, loopback, link-local and cloud-metadata addresses MUST be refused, the check MUST be repeated after every redirect, and only web-page (HTML) responses up to a fixed size cap MUST be read; anything else ends the lookup with "no image found".
- **FR-005**: An image found by the page lookup that is shared by 2 or more articles of the same source MUST be treated as a site logo and discarded.
- **FR-006**: Only absolute http(s) image addresses MUST be accepted; anything else is ignored.
- **FR-007**: When no image is found, or an image fails to load in the browser, the article MUST show a source-branded placeholder that identifies the source by name or monogram, meets contrast requirements, and occupies exactly the image's space (no layout shift).
- **FR-008**: Article images MUST be treated as decorative next to the visible title (not announced a second time by assistive technology).

**View**

- **FR-009**: The news view MUST implement concept A "Portada" (research.md §3) for both phone and desktop widths: the lead slot shows the most recent article that has a real image; the next 2–4 most recent articles with a real image fill the secondary tiles, taking at most one of them per source while other sources have candidates; every remaining article goes to a compact "Latest" list in reverse chronological order. Articles with only a placeholder MUST NOT occupy the lead or secondary slots. Concepts B and C MUST NOT be built.
- **FR-010**: The all-sources view MUST show up to the 60 most recent articles published in the last 7 days across available sources, and every available source with articles in that window MUST contribute at least its 3 most recent ones (or all it has, if fewer), replacing today's cap of 10 articles in total. Sources with nothing in the window are absent from the all-sources view but remain in the source filter.
- **FR-011**: Each article MUST show title, source name, relative publication age ("just now", "25m ago", "3h ago", "2d ago"; a short date such as "Sep 12" from 7 days) with the exact date/time available on hover and to assistive technology, and image or placeholder; the excerpt MAY be shown where the concept allows.
- **FR-012**: Selecting an article MUST open the original article on the source's site in a new tab; the view MUST NOT reproduce full article content.
- **FR-013**: The category filter MUST be removed (all sources share a single category, so it filters nothing); the source filter MUST remain available in one tap (US3), priority sources listed first as today. Selecting a source MUST show all of that source's current articles, without the 7-day window, in the same Portada layout with the rules of FR-009 applied to that source alone.
- **FR-014**: Items with the same link or identifier MUST be shown only once.
- **FR-015**: An unavailable source MUST be indicated on its own filter chip with an icon plus the text "unavailable" (never colour alone); the chip MUST stay selectable (US3 scenario 3), no banner MUST be shown, and the rest of the news MUST NOT be blocked or hidden. Loading MUST show skeletons that match the Portada layout.
- **FR-016**: The view MUST conform to WCAG 2.1 AA: semantic list/heading structure, keyboard operability with visible focus, 44×44 px targets, 4.5:1 text contrast, selection not indicated by colour alone, and `prefers-reduced-motion` honoured.
- **FR-017**: Motion MUST be limited to the existing press feedback; content changes (loading, filter change) appear without animation, and there are no per-article entrance animations.

### Key Entities *(include if feature involves data)*

- **Feed Source**: A curated news outlet — display name, feed address, enabled flag, priority flag (filter ordering only). Carries no source-specific parsing rules.
- **News Item (Article)**: One story from a source — identifier, title, plain-text excerpt, image address (optional), publication time, link to the original, source reference. Unique by link/identifier.
- **Image Lookup Result**: The outcome of looking up an article's page for a preview image — article link, image address or "none", time checked. Kept while the article stays in its source's feed, for at most 7 days.
- **Source Status**: Availability of a source for the current refresh (available / temporarily unavailable), shown to the user on the source's filter chip.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: With the current 8 sources, at least 90 % of all fetched articles show their real article image (baseline 81.6 %, research.md §1.3), and at least 7 of 8 sources show real images for 90 % or more of their articles (baseline 5 of 8).
- **SC-002**: 100 % of displayed articles show either a real image or the source-branded placeholder; 0 empty boxes or broken-image icons in a full-page check with one image URL deliberately broken.
- **SC-003**: With all sources available, the all-sources view shows articles from 100 % of sources that published in the last 7 days (today a single prolific source can hide all others).
- **SC-004**: A user can identify the newest article and its source within 5 seconds of the view appearing, with zero taps, in a moderated check on a phone-width screen; on phone width the first screen shows at least the title counts of US2 scenario 4 (today: 3–4 titles).
- **SC-005**: When cached news is fresh the view appears no slower than today; on a cold refresh the added image lookup delays the news response by no more than 1 second over today.
- **SC-006**: Automated accessibility checks of the view report 0 WCAG 2.1 AA violations in light and dark themes.
- **SC-007**: Adding a new source that uses any supported image location requires changing only the source list (name + feed address), verified by adding a test source.

## Assumptions

- The redesign replaces the news view in place (the Dashboard page); navigation and authentication are unchanged.
- Sources remain curated by the project owner in configuration; users cannot add their own feeds.
- UI copy stays in English, as in the rest of the app.
- 60 items and at least 3 per source (FR-010), 7 days for relative age (FR-011) and 1 second extra cold-load budget (SC-005) are informed defaults; the 7-day "recent" window (FR-010) and 7-day image-lookup retention (FR-004) were confirmed in clarify.
- Images are loaded directly from the publishers' servers (verified: no hotlink blocking for current sources); re-hosting images is not needed.
- The existing per-source refresh interval (20 minutes) and per-source failure isolation are kept.
- "Lead" means the most recent article with a real image, not the most important one: there is no importance signal in the feeds (accepted trade-off of concept A, research.md §3).
- Metal Underground has no per-article image anywhere; it will show the placeholder (research.md §1.3).

### Out of scope

- Read/unread state, "new since last visit" markers, bookmarks — add when users ask to track what they have read.
- Cross-source clustering of the same story — add if duplicate coverage becomes a real complaint.
- User-managed feed sources — add if multi-user curation is requested.
- Multiple view modes / layout toggle — add only if feedback splits between concepts.
- Pagination or infinite scroll beyond FR-010's window — add if users regularly reach the end.
- Image proxying/re-hosting — add if a source starts blocking hotlinks.
- In-app article preview/reader — conflicts with Principle VII and adds a step.

### Dependencies

- Spec 041 source filter behaviour (US3) and spec 024 plain-text sanitisation of feed content remain in force.
- Constitution Principles VII (attribution, graceful degradation), IX (browser only calls the backend; images load via plain image elements), X (WCAG 2.1 AA) and XI (Apple design principles).
