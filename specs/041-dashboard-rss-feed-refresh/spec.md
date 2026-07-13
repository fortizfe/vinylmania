# Feature Specification: Dashboard RSS Feed Sources Refresh

**Feature Branch**: `041-dashboard-rss-feed-refresh`

**Created**: 2026-07-13

**Status**: Draft

**Input**: User description: "Quiero seguir puliendo el apartado de feeds RSS del Dashboard: (1) eliminar Metal Storm del catálogo de fuentes porque no aporta valor, (2) incorporar 6 fuentes RSS nuevas, y (3) corregir el comportamiento del filtro por fuente para que, al pulsar la etiqueta de una fuente, se muestre todo lo que esa fuente tiene publicado — consultando su feed directamente si hace falta — en vez de depender únicamente de lo que ya se ve en la vista general."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Retire Metal Storm from the news catalog (Priority: P1)

As the project owner, I want Metal Storm completely removed from the news feed
system, so that it stops consuming request budget and Dashboard space, since
it no longer provides value.

**Why this priority**: Metal Storm currently occupies 5 of 8 configured
sources and is the sole producer of 4 of the Dashboard's 5 categories. Its
removal is a prerequisite for a clean state before the new sources (User
Story 2) are added, and removes dead code and stale test coverage.

**Independent Test**: Can be fully tested by loading the Dashboard after the
change and confirming no card, filter label, or status banner mentions
"Metal Storm" anywhere, while the remaining pre-existing sources (Metal
Injection, MetalSucks, Louder Sound) keep working exactly as before.

**Acceptance Scenarios**:

1. **Given** the configured source catalog, **When** the change is applied,
   **Then** no source entry has an identifier or display name referencing
   Metal Storm.
2. **Given** the Dashboard after the change, **When** a collector visits it,
   **Then** no article card, source-filter label, or "source unavailable"
   status banner mentions Metal Storm anywhere.
3. **Given** that the categories Reviews, Interviews, Articles, and Staff
   Picks are today produced exclusively by Metal Storm, **When** Metal Storm
   is removed, **Then** those 4 categories stop appearing on the Dashboard
   (unless one of the new sources from User Story 2 reintroduces a category)
   — this is an expected consequence of the removal, not a defect to fix
   separately.
4. **Given** the Metal-Storm-specific article image extraction behavior,
   **When** Metal Storm is removed, **Then** that behavior and its dedicated
   test coverage are also removed so no unused, source-specific logic remains
   for a source that no longer exists.
5. **Given** the remaining existing sources (Metal Injection, MetalSucks,
   Louder Sound), **When** the change is applied, **Then** their behavior is
   unaffected.

---

### User Story 2 - Add 6 new RSS sources (Priority: P1)

As a collector visiting the Dashboard, I want to see news from 6 new metal
sources, so that I have more variety and volume of genre news after Metal
Storm is retired.

**Why this priority**: Directly replaces the volume and variety lost by
retiring Metal Storm (User Story 1), so the Dashboard doesn't regress in
content richness.

**Independent Test**: Can be fully tested by loading the Dashboard after the
change and confirming articles from each of the 6 new sources appear
(individually verifiable via the source filter), with a failing individual
source degrading gracefully rather than breaking the rest of the Dashboard.

**Sources to add** (reachability verified against the live feed on
2026-07-13):

| Source | Feed URL | Verified status |
|---|---|---|
| Heavy Mag | `https://heavymag.com.au/feed/` | Reachable, valid RSS feed |
| Metal Underground | `https://feeds.feedburner.com/metalunderground` | Reachable, valid feed with confirmed metal-news content |
| Metal Blade Records | `https://www.metalblade.com/us/feed/` | **Unconfirmed** — no automated response obtained from the feed URL or its variants, even though the main site responds normally. Must be confirmed live during planning/implementation before being enabled; if it turns out to be persistently unreachable, it must be treated like any other down source (graceful per-source degradation) rather than blocking the rest of this story |
| Heavy Metal Overload | `https://heavymetaloverload.com/feed/` | Reachable, valid RSS feed |
| Femme Metal | `https://femmetal.rocks/feed/` | Reachable, valid RSS feed |
| MetalTalk | `https://www.metaltalk.net/feed` | Reachable, valid RSS feed |

**Acceptance Scenarios**:

1. **Given** the source catalog, **When** the change is applied, **Then** it
   contains one new entry for each of the 6 sources above, enabled and
   following the same shape as existing sources (identifier, display name,
   feed URL, category, priority flag).
2. **Given** each new source is reachable, **When** the Dashboard aggregates
   all sources, **Then** its articles appear the same way as any existing
   source's articles, with per-source failure isolation (an individual feed
   being down must not break the rest of the Dashboard).
3. **Given** the source filter control, **When** it renders, **Then** a new
   label appears for each new source, respecting the existing ordering
   (priority sources first).
4. **Given** Metal Blade Records specifically could not be verified
   automatically, **When** this story is implemented, **Then** its real
   reachability must be confirmed before it is treated as enabled; if it
   turns out to be persistently blocked, that limitation must be documented
   rather than the source being added blindly.

---

### User Story 3 - A source's filter label shows all of its content, not only what's already visible (Priority: P1)

As a collector visiting the Dashboard, I want clicking a source's filter
label to show everything obtained from that source's feed — querying it
directly if needed — so that I don't miss articles that genuinely exist in
the feed but that the general view didn't happen to display.

**Why this priority**: Without this fix, the source filter can silently
show a false "no news" empty state for sources that publish less frequently
than others in the same category, undermining the reliability of the filter
control itself.

**Independent Test**: Can be fully tested by selecting a source whose
articles are known to be absent from the aggregated general view and
confirming its real articles appear instead of a false empty state, while a
source that already appears in the general view keeps behaving consistently
when selected.

**Acceptance Scenarios**:

1. **Given** a source whose articles don't appear in the general view
   (because they were excluded by the per-category recency limit),
   **When** the collector clicks that source's filter label, **Then** that
   source's real articles are shown (querying its feed directly if
   necessary), not a false empty state.
2. **Given** a source whose articles already appear in the general view,
   **When** the collector clicks its filter label, **Then** the result is
   consistent — no duplicated articles, and no different behavior depending
   on whether the source happened to make the general view's cutoff or not.
3. **Given** the selected source fails or doesn't respond when queried
   directly, **When** that happens, **Then** the collector sees a clear
   "source unavailable" state (reusing the existing graceful-degradation
   pattern), distinguished from "this source has no articles."
4. **Given** the collector has filtered by a source, **When** they select
   "All sources" again, **Then** they see the original aggregated Dashboard
   view again, with no trace of the previous filter.

**Edge Cases**:

- If a source is already known to be unavailable (it failed during the
  general Dashboard load), clicking its label re-attempts the direct query
  rather than immediately showing "unavailable" without retrying — a source
  should get a fresh chance every time its label is clicked, consistent with
  "query the feed directly if needed."
- If a category filter is active at the same time the collector clicks a
  source's label, the two filters keep combining the same way they do today
  (both conditions must match). Since each source belongs to exactly one
  category, a source/category combination that doesn't match produces an
  empty result — this is expected filter behavior, not a defect, and it does
  not change how the active category filter otherwise behaves.
- A source that genuinely has zero articles in its real feed (as opposed to
  zero articles surviving the general view's recency cutoff) still shows a
  plain empty state, never an error state.

---

## Clarifications

### Session 2026-07-13

- Q: Al filtrar por una fuente y consultar su feed directamente, ¿cuántos artículos debe mostrar la vista filtrada? → A: Todos los que el feed entregue, sin recorte adicional aplicado por la aplicación más allá del propio límite natural del proveedor del feed.
- Q: ¿Cuánto debe esperar la consulta directa antes de considerar que una fuente "no responde" (FR-010)? → A: Reutilizar el mismo umbral de timeout que ya aplica el sistema al consultar feeds en la vista general agregada, sin definir un umbral nuevo específico para esta consulta directa.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The source catalog MUST NOT contain any Metal Storm entry
  (identifier or display name) after this change.
- **FR-002**: The Dashboard (article cards, source-filter labels, and
  "source unavailable" status indicators) MUST NOT display or reference
  Metal Storm after this change.
- **FR-003**: Removing Metal Storm MUST NOT alter the behavior of any other
  existing source (Metal Injection, MetalSucks, Louder Sound).
- **FR-004**: Any source-specific behavior that exists solely to support
  Metal Storm (including its dedicated article-image extraction handling)
  MUST be removed along with Metal Storm, leaving no dead, source-specific
  logic behind.
- **FR-005**: The source catalog MUST include the 6 new sources listed in
  User Story 2, each enabled and configured with the same required
  attributes (identifier, display name, feed URL, category, priority flag)
  as existing sources.
- **FR-006**: Metal Blade Records' real reachability MUST be confirmed
  before it is enabled; if it is persistently unreachable, this MUST be
  handled the same way as any other unavailable source (graceful per-source
  degradation) and documented rather than silently assumed to work.
- **FR-007**: Each source (existing or new) MUST fail independently — one
  unreachable or malformed feed MUST NOT prevent the Dashboard or any other
  source from rendering its own available content.
- **FR-008**: Selecting a source via its filter label MUST show every
  article present in that source's feed at query time, obtained by querying
  that source directly, rather than only the subset of articles that
  happened to survive the general aggregated view's per-category recency
  limit. No additional application-side cap MUST be applied beyond whatever
  natural limit the source's own feed already imposes.
- **FR-009**: Selecting a source whose articles already appear in the
  general aggregated view MUST produce a consistent result: the same
  articles, without duplicates, regardless of whether that source's content
  made the general view's cutoff.
- **FR-010**: If the selected source fails, or does not respond within the
  same timeout threshold already applied to feed requests in the general
  aggregated view, when queried directly, the collector MUST see a distinct
  "source unavailable" state, clearly different from "this source currently
  has no articles."
- **FR-011**: Returning to "All sources" after filtering by a specific
  source MUST restore the original aggregated Dashboard view, with no
  residual effect from the previous source selection.
- **FR-012**: An active category filter and an active source filter MUST
  continue to combine as they do today (both conditions apply); this
  feature MUST NOT change category-filter behavior.
- **FR-013**: The general aggregated Dashboard view's per-category article
  count limit MUST remain unchanged; this feature only changes what happens
  when a single source's label is selected.

### Key Entities

- **Feed Source**: A configured RSS source the Dashboard aggregates from.
  Key attributes: identifier, display name, feed URL, category (News,
  Reviews, Interviews, Articles, Staff Picks, or another declared by an
  active source), a priority flag controlling filter-label ordering, and an
  enabled/disabled state.
- **Aggregated Article**: A news item produced by mapping a feed source's
  raw entries into the Dashboard's display shape, grouped by category and
  attributed back to its originating source.
- **Source Availability Status**: Per-source state (available / unavailable)
  shown to the collector when a source could not be reached, independent
  from a source simply having no articles.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: The source catalog contains zero Metal Storm entries and all
  6 newly verified reachable sources (with Metal Blade Records confirmed
  live before being counted as enabled).
- **SC-002**: The Dashboard shows zero references to Metal Storm (cards,
  filter labels, status banners) after the change ships.
- **SC-003**: Clicking any source's filter label shows all of that source's
  currently published articles whenever it has any, with 0% of clicks
  producing a false "no news" result caused solely by the general view's
  per-category recency cutoff.
- **SC-004**: A collector can distinguish, without ambiguity, between a
  selected source having no articles and a selected source being
  unavailable, in 100% of cases.
- **SC-005**: An individual source failing to respond never prevents the
  rest of the Dashboard's sources or categories from rendering.

## Assumptions

- **Category for the 6 new sources**: no category was specified for the new
  sources individually, so all 6 are classified as `News`, matching Metal
  Injection, MetalSucks, and Louder Sound. A consequence of this default
  combined with Metal Storm's removal is that the Dashboard's category
  filter temporarily has only one populated category (`News`) until new
  categorized sources are added — this is an accepted, documented tradeoff
  of this change, not a defect.
- **Priority of the 6 new sources**: no source was flagged as needing to
  appear first in the filter, so all 6 are treated as non-priority, leaving
  Metal Injection, MetalSucks, and Louder Sound as the only priority
  sources.
- **Relative priority of the three stories**: all three are P1 because they
  are one continuous body of work on the same Dashboard area; they may be
  delivered as separate, independently reviewable changes within that same
  priority.
- **Retry behavior on source selection**: clicking a source's filter label
  always attempts a fresh, direct query of that source, even if that source
  was already flagged unavailable during the general Dashboard load —
  consistent with the goal of always showing what the feed actually has "if
  needed."
- **Category + source filter interaction**: the existing combination
  behavior (both filters must match) is preserved as-is; this feature does
  not change what happens when an active category filter and a selected
  source's category disagree.
- **Mechanism for "querying the feed directly"**: how the direct,
  per-source query is implemented (e.g., a new endpoint, a parameter on the
  existing endpoint) is a planning/implementation decision, not part of
  this specification.
