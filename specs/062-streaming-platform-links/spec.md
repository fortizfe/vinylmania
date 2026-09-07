# Feature Specification: "Escúchalo en Streaming" — Direct Streaming Platform Links on Record Detail

**Feature Branch**: `062-streaming-platform-links`

**Created**: 2026-09-07

**Status**: Draft

**Input**: User description: "Quiero añadir una pequeña sección \"Escúchalo en streaming\" (o similar) en todas las vistas donde se muestra el detalle de un disco: el popup de vista previa desde resultados de búsqueda, y la página de detalle de release/master que también usan tanto un disco de mi biblioteca como uno de mi lista de deseos. Debe mostrar enlaces directos a las plataformas de streaming del disco, para poder ir a escucharlo online en un solo clic. Por ahora solo se integra Apple Music, pero el componente debe construirse pensando en añadir más adelante Spotify, Amazon Music, Deezer y Tidal sin rehacer nada..."

## Overview

Vinylmania shows the detail of a record in several places: a preview popup opened from search results, and a full release/master detail page that is reached both from the library ("Mi biblioteca") and from the wantlist ("Lista de deseos"). Today none of those surfaces offer a way to actually go and listen to the record online.

This feature adds a small, reusable **"Escúchalo en streaming"** section to every record-detail surface. The section shows direct links to the streaming platforms where that specific record exists, so a collector can open it in their streaming service in a single click. The section is not a search shortcut and not a store: it only ever links to a real, matched record.

For this first version only **Apple Music** is resolved. Apple Music links are resolved through the **free iTunes Search API** (no developer account, no authentication): first an exact lookup by the record's barcode (a "Barcode" identifier Discogs already provides per release), and, if that yields nothing, a text-search fallback by artist + title. Records that are not on Apple Music with a reliable match — common for vinyl-exclusive pressings and independent rock/metal labels — simply do not show an Apple Music link. There is never a broken link, a visible error, or a generic "search this on Apple Music" link.

The section is built to grow: Spotify, Amazon Music, Deezer, and Tidal are explicitly out of scope for this version, but the section and the backend must be structured so each of them is added later as an independent resolver/adapter, without reworking Apple Music or the shared section. Each platform resolves independently; one platform failing or having no match never affects the others.

## Clarifications

### Session 2026-09-07

- Q: Apple Music storefront strategy (fixed store vs. per-user) → A: Resolve per the viewing user's locale/country; the resolution cache is keyed by record + platform + storefront.
- Q: What the user sees on first view while a cache-miss resolution is still running → A: Reserve the section's space and show a skeleton while resolving, then fill in the link(s) in place — or collapse the section to nothing — when the result arrives (live update within the same view).
- Q: How the viewing user's storefront/country is determined → A: Derived from the browser/request locale (`navigator.language` / `Accept-Language`) mapped to a storefront, falling back to `ES` when it can't be mapped. No new user profile field or setting is introduced.
- Q: Concrete cache validity window for a resolution result → A: 90 days for both a match and a confirmed no-match; transient failures are not cached as permanent and are retried on the next view.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Open a record in Apple Music from its detail page (Priority: P1)

A collector opens the release/master detail page of a record — whether they reached it from their library or from their wantlist. Below the record's information they see a small "Escúchalo en streaming" section with an Apple Music link, because this record was found on Apple Music. They click it once and the record's Apple Music page opens in a new tab, ready to play. If the record is not on Apple Music, the section shows no Apple Music link (and, with only Apple Music integrated, the section itself is simply not shown for that record).

**Why this priority**: This is the core of the feature — the reusable section, Apple Music resolution via the iTunes Search API, and the "only show a link when there is a real match" rule. Everything else builds on it.

**Independent Test**: Open the detail page of a record known to be on Apple Music (with a barcode) and verify a single click reaches the correct Apple Music album page. Open the detail page of a record known not to be on Apple Music and verify no Apple Music link (and no error, no placeholder) is shown.

**Acceptance Scenarios**:

1. **Given** a record whose barcode identifier resolves to an album on Apple Music, **When** the user opens its release detail page, **Then** the "Escúchalo en streaming" section shows an Apple Music link that opens that album's Apple Music page in a new tab in one click.
2. **Given** a record with no barcode identifier but whose artist + title match an album on Apple Music, **When** the user opens its detail page, **Then** the Apple Music link is shown and points to the matched album.
3. **Given** a record that has no reliable match on Apple Music, **When** the user opens its detail page, **Then** no Apple Music link is shown, no error message is shown, and no generic "search on Apple Music" link is shown.
4. **Given** the same detail page is opened from the library and from the wantlist, **When** the user views it in each case, **Then** the "Escúchalo en streaming" section behaves identically.
5. **Given** the Apple Music page opens, **When** the user is taken there, **Then** no audio has played inside Vinylmania and Vinylmania remains open in its original tab.

---

### User Story 2 - Same one-click streaming access from the search preview popup (Priority: P1)

A collector searches for a record and opens its preview popup from the results without navigating to the full detail page. The same "Escúchalo en streaming" section appears in the popup, resolved for that record, so they can jump straight to Apple Music without opening the full page first. The link resolution behaves exactly as it does on the detail page — the logic is shared, not re-implemented for the popup.

**Why this priority**: The user explicitly wants streaming access on every detail surface, and the search popup is where a collector most often decides "let me hear this". It is P1 alongside Story 1; together they deliver the feature on all the intended surfaces.

**Independent Test**: From a search result, open the preview popup for a record on Apple Music and verify the Apple Music link is present and correct; open the popup for a record not on Apple Music and verify no Apple Music link appears. Confirm the same record shows the same result in the popup and on the full detail page.

**Acceptance Scenarios**:

1. **Given** a search result for a record matched on Apple Music, **When** the user opens its preview popup, **Then** the "Escúchalo en streaming" section shows the Apple Music link.
2. **Given** a record shown both in a preview popup and on its detail page, **When** the user views both, **Then** the streaming section resolves to the same links in both places.
3. **Given** a record with no Apple Music match, **When** the user opens its preview popup, **Then** the streaming section shows no Apple Music link and no error.
4. **Given** the preview popup is closed and re-opened for the same record, **When** it re-opens, **Then** the streaming section does not trigger a fresh external lookup (the earlier result is reused).

---

### User Story 3 - Records not on Apple Music never show a broken or misleading link (Priority: P2)

A collector browses a catalogue heavy in vinyl-exclusive and independent rock/metal releases. Many of these records are not on Apple Music at all. For every such record, the streaming section quietly omits Apple Music — the collector never sees a dead link, an error, a spinner that never resolves, or a link that just runs an Apple Music search. When Apple Music genuinely can't be reached at that moment (timeout, rate limit, outage), the record is not permanently marked as "not available"; it can resolve successfully later.

**Why this priority**: Trust in the section depends on it never lying. This is a distinct, independently testable quality bar, but the feature is demonstrable without hardening every failure path, so it ranks below the two P1 surfaces.

**Independent Test**: Open detail surfaces for a set of records known to be absent from Apple Music and confirm no Apple Music link and no visible error for any of them. Simulate an iTunes Search API failure and confirm the section degrades silently and the record remains eligible for a later successful resolution.

**Acceptance Scenarios**:

1. **Given** a record absent from Apple Music, **When** its detail surface is shown, **Then** the section shows no Apple Music link and no error indicator.
2. **Given** the iTunes Search API times out or rejects the request for rate limiting, **When** the detail surface is shown, **Then** the rest of the record detail renders normally and the streaming section is simply absent/empty.
3. **Given** a resolution attempt failed transiently, **When** the same record's detail is opened again after the transient condition clears, **Then** a successful match (if one exists) is found and shown, i.e. the earlier failure was not stored as a permanent "no match".
4. **Given** a barcode lookup returns a result that does not correspond to the same record, **When** resolution runs, **Then** that result is rejected and treated as no match rather than shown as the record's link.

---

### User Story 4 - Ready for more streaming platforms without rework (Priority: P3)

The product owner plans to add Spotify, then Amazon Music, Deezer, and Tidal. When that work starts, adding a platform means adding one new independent resolver (frontend) and one new adapter (backend) plus its icon — the Apple Music resolver, the shared section, and the other platforms are not touched. Each new platform shows its icon only for records it actually matched, and a new platform that fails to resolve does not affect Apple Music or any other platform already shown.

**Why this priority**: This is a structural guarantee rather than user-visible behaviour in this release, so it is lowest priority, but it is the explicit reason the section is being built now rather than hard-coding a single Apple Music link.

**Independent Test**: Design/architecture review confirms the section renders an arbitrary list of independently-resolved platforms and that Apple Music is one entry among them, not a special case. When the first additional platform is later implemented, confirm no change was needed to the Apple Music resolver or the shared section.

**Acceptance Scenarios**:

1. **Given** the shared streaming section, **When** it renders, **Then** it displays whichever platform links resolved for the record, as an open-ended list, with Apple Music being one entry among equals.
2. **Given** a hypothetical second platform is added, **When** its resolver is introduced, **Then** the Apple Music resolver and the shared section require no modification.
3. **Given** two or more platforms are integrated and one of them fails to resolve for a record, **When** the section renders, **Then** the platforms that did resolve are still shown normally.

---

### Edge Cases

- **Record has no barcode identifier** (e.g. a master, or an older release): resolution skips the barcode lookup and goes straight to the artist + title text fallback.
- **Barcode present in Discogs but unknown to iTunes**: barcode lookup returns nothing → text fallback runs → if it also finds nothing reliable, Apple Music is omitted for that record.
- **Barcode lookup returns a different album** (barcode reused, compilation, wrong metadata): the mismatched result is rejected; treated as no match.
- **Text fallback returns multiple candidate albums**: only a candidate that reliably corresponds to the record (artist and title) is accepted; ambiguous results are treated as no match rather than guessed.
- **iTunes Search API rate limit (~20 req/min) reached**: the request is not retried aggressively; the section degrades silently for that view; a cached result is used if present; the record stays eligible for later resolution.
- **Same record opened repeatedly** (popup, then detail page, then popup again): only the first resolution hits the external API within the cache window; subsequent views reuse the cached result (match or confirmed no-match).
- **Apple Music later removes the album**: the cached link eventually expires and re-resolves; until then the link may 404 on Apple's side (accepted for the long cache window; not something Vinylmania can detect without re-querying).
- **Various-artists / compilation releases**: resolution relies on the same identifiers/artist/title inputs; if no reliable match, Apple Music is omitted.
- **Backend or network unavailable when the surface loads**: the streaming section collapses to nothing after its resolution attempt fails; the rest of the record detail is unaffected.
- **First view of a record, cache miss, resolution takes ~1–2s**: the section shows a skeleton in its reserved space, then live-fills the link(s) or collapses when the result returns — no reload needed.
- **User navigates away before a first-view resolution completes**: the resolution result is still cached server-side, so the next view of that record (this user or another on the same storefront) is a cache hit.
- **Record detail surface shown to a user who has not linked a Discogs account**: the streaming section still works, because it does not use user-specific data.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST show an "Escúchalo en streaming" (or similarly named, Spanish) section on every surface that displays a record's detail: the search-results preview popup and the release/master detail page (reached from both the library and the wantlist).
- **FR-002**: The streaming section MUST be a single reusable unit; the logic that resolves streaming links MUST NOT be duplicated between the preview popup and the detail page.
- **FR-003**: The section MUST resolve links using only data Vinylmania already holds for the record — its identifiers (including Discogs "Barcode" identifiers), artist, and title — and MUST NOT require any new request to Discogs.
- **FR-004**: For each supported platform, the section MUST show that platform's icon/link ONLY when a specific real record has been matched on that platform. Unmatched platforms MUST NOT render a placeholder, a greyed-out item, an error, or a generic "search on <platform>" link.
- **FR-005**: Each platform MUST be resolved independently of every other platform; a failure, timeout, or absent match for one platform MUST NOT affect the resolution or display of any other platform.
- **FR-006**: For this version, Apple Music MUST be the only platform resolved. The section and its backing logic MUST be structured so that Spotify, Amazon Music, Deezer, and Tidal can each be added later as an independent resolver without modifying the Apple Music resolver or the shared section.
- **FR-007**: Apple Music links MUST be resolved via the free, unauthenticated iTunes Search API. The paid Apple Music API MUST NOT be used.
- **FR-008**: Apple Music resolution MUST first attempt an exact lookup by the record's barcode identifier(s). If the record has no barcode, or the barcode lookup returns no usable album, resolution MUST fall back to a text search by artist + title.
- **FR-008a**: Apple Music resolution MUST be performed against the viewing user's own storefront/country, so the returned link points to a page playable in that user's region. The storefront MUST be derived from the browser/request locale (`navigator.language` / `Accept-Language`) mapped to a storefront code, falling back to `ES` when no mapping applies. No new user profile field or user-facing setting is introduced for this. A resolution result (match, no-match, or the link URL) is specific to a storefront and MUST NOT be reused for a different storefront.
- **FR-009**: A candidate result MUST be accepted only when it reliably corresponds to the same record (a barcode match, or an artist-and-title correspondence for the text fallback). When no reliable match is found, the Apple Music entry MUST be omitted for that record — never a broken link, a visible error, or a generic search link.
- **FR-010**: Activating a platform link MUST open that platform's page for the matched record (e.g. the album page) in a new browsing context. Vinylmania MUST NOT play audio in-app and MUST remain open in its original tab.
- **FR-011**: The outcome of a resolution attempt — including a confirmed "no match" — MUST be cached for 90 days, keyed by platform + record identity + storefront, so that re-opening the same record's detail within that window (by any user on the same storefront) does not trigger a new iTunes Search request. After the window expires, the next view re-resolves and refreshes the entry.
- **FR-012**: The system MUST operate within the iTunes Search API's documented rate limit (~20 requests/minute) across all users combined, relying on the cache to avoid repeat requests for the same record.
- **FR-013**: A transient resolution failure (timeout, rate-limit rejection, service unavailable) MUST NOT be persisted as a permanent "no match"; the record MUST remain eligible for a later resolution attempt.
- **FR-014**: If resolution has not completed, is unavailable, or fails when a detail surface is displayed, the rest of the record detail MUST render normally. While a first-view (cache-miss) resolution is still running, the section MUST reserve its space and show a skeleton; when the result arrives it MUST fill in the resolved link(s) in place, or collapse the section to nothing if there is no match. A failed or unavailable resolution MUST collapse the section — no error state, no broken layout, no perpetual spinner.
- **FR-014a**: The skeleton-to-populated (or skeleton-to-collapsed) transition on first view MUST happen live within the same view, without requiring the user to reload or re-open the surface.
- **FR-015**: Backend support for streaming-link resolution MUST follow the same ports/adapters pattern already used for external integrations (Discogs), with each streaming platform behind its own adapter, so that adding a platform is implementing another adapter rather than changing existing code.
- **FR-016**: The section MUST NOT display prices, purchase links, or "available to buy" information from any platform.
- **FR-017**: The streaming section MUST NOT introduce layout shift beyond its own reserved area: its skeleton/loading, empty, and populated states MUST occupy consistent space, and the transition from skeleton to populated (or to collapsed) MUST NOT push the surrounding record detail around.
- **FR-018**: The section MUST meet accessibility requirements: every platform link MUST have an accessible name identifying the platform, MUST be keyboard operable with a visible focus state, and MUST NOT rely on colour or icon shape alone to be understood.
- **FR-019**: Resolution attempts and their outcomes (platform, method used — barcode or text, result — matched / no-match / transient failure) MUST be logged with enough context to diagnose problems in production.
- **FR-020**: The streaming section MUST be shown regardless of whether the viewing user has linked a Discogs account; it depends only on the record and the request locale, not on the user's account or any user-specific state.

### Key Entities *(include if feature involves data)*

- **Streaming platform**: A music service Vinylmania can link out to (Apple Music now; Spotify, Amazon Music, Deezer, Tidal later). Attributes: identifier, display name, icon, whether a resolver is currently active.
- **Record resolution inputs**: The subset of a record's existing data used to resolve links — barcode identifier(s), primary artist name, release/master title.
- **Resolved streaming link**: The outcome of resolving one platform for one record. Attributes: platform, the record it belongs to, target URL (when matched), resolution method used (barcode / text fallback), match/no-match/failure state, timestamp of resolution.
- **Resolution cache entry**: A stored resolution outcome keyed by platform + record identity + storefront, valid for 90 days. Distinguishes a confirmed "no match" (cached 90 days) from a transient failure (not cached as permanent). Shared across users on the same storefront.
- **Storefront**: The regional music store a resolution is performed against and that the resolved link is valid for, derived from the browser/request locale (fallback `ES`). Not persisted per user.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: From any record-detail surface (preview popup or detail page) for a record available on Apple Music, a user reaches that record's Apple Music page in a single click.
- **SC-002**: For records with no reliable Apple Music match, zero broken links, error messages, or generic search links are shown — the Apple Music entry is always simply absent.
- **SC-003**: Re-opening the same record's detail (any surface) within the 90-day cache window causes at most one iTunes Search request for that record per storefront; the second and subsequent views on that storefront are served entirely from cache.
- **SC-004**: Under normal browsing load, Vinylmania never exceeds the iTunes Search API rate limit — no resolution is dropped or delayed because the app hit the limit in typical use.
- **SC-005**: When Apple Music resolution is slow, unavailable, or failing, 100% of the record-detail content still renders; the streaming section's absence never blocks or breaks a detail surface.
- **SC-006**: In a review sample of matched records, 100% of barcode-based Apple Music links open the album corresponding to that barcode, and at least 95% of text-fallback links open the correct album.
- **SC-007**: The preview popup and the detail page show the same streaming result for the same record in 100% of checked cases (shared resolution, no divergence).
- **SC-008**: Adding the next streaming platform later requires no code change to the Apple Music resolver or to the shared streaming section (verified when that platform is implemented, or by design review before then).
- **SC-009**: The streaming section passes a WCAG 2.1 AA review (keyboard operability, visible focus, contrast, accessible names, no colour-only meaning) and introduces no measurable layout shift on any detail surface.

## Assumptions

- **Apple Music storefront**: Links are resolved against the viewing user's own storefront, derived from the browser/request locale (`navigator.language` / `Accept-Language`) mapped to a storefront code (see Clarifications 2026-09-07). When no mapping applies, resolution falls back to the Spanish store (`country=ES`), consistent with the app's primary audience. Cache entries are per-storefront. No new user profile field or setting is added.
- **Link granularity**: Links target the album/release page on the platform, not individual tracks or a "now playing" deep link.
- **Cache window length**: 90 days for both a match and a confirmed no-match (see Clarifications 2026-09-07), since a record's streaming availability changes rarely. Transient failures are not cached as permanent.
- **Master vs. release resolution**: A master (which has no single barcode) is resolved by artist + title text search. A specific release is resolved barcode-first, then text fallback.
- **Shared, server-side cache**: Resolution results are cached on the backend and shared across all users on the same storefront, because the streaming link for a given record depends only on the record and the storefront, not on the individual user.
- **Text-fallback match rule**: The text fallback accepts a candidate only when both the artist and the title correspond after normalisation (case-, accent-, and punctuation-insensitive). An artist-only or title-only match is treated as no match.
- **iTunes Search API availability**: The iTunes Search API remains free and usable without authentication (its current behaviour). If Apple changes this, the Apple Music resolver degrades to "no match" like any other failure.
- **Not-yet-integrated platforms**: No icon, tooltip, or "coming soon" affordance is shown for Spotify, Amazon Music, Deezer, or Tidal until each one's resolver ships.
- **No user preference**: No "preferred streaming service" setting is introduced; all resolved platforms are shown.
- **Existing detail data**: The record-detail surfaces already expose the record's Discogs identifiers, artist, and title (from features 010, 012, 014, 026); this feature consumes that data and does not add new Discogs calls.
- **Existing resilience/caching infrastructure**: The backend's existing external-integration resilience and caching layers (used for Discogs) are available to reuse for the iTunes Search integration.

## Dependencies

- The record-detail surfaces (search preview popup, release/master detail page) must already provide the record's identifiers, artist, and title.
- The backend's existing ports/adapters structure and its caching/resilience layer for external integrations.
- Public availability of the iTunes Search API (free, unauthenticated).
