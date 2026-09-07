# Feature Specification: Mi colección en cifras — Collection Stats & Estimated Market Value

**Feature Branch**: `061-collection-stats-valuation`

**Created**: 2026-09-06

**Status**: Draft

**Input**: User description: "Ahora quiero explotar datos de catálogo y de mi colección que ya traemos de Discogs pero que hoy no se muestran más allá de la ficha individual de cada disco. La idea es una nueva sección 'Mi colección en cifras', con dos bloques: (1) Estadísticas de la colección construidas solo con datos que ya se obtienen hoy al cargar la biblioteca; (2) Valoración estimada de mercado de la colección usando el endpoint autenticado de Discogs de sugerencias de precio por condición, cruzado con el estado real de cada copia (media condition) que ya guardamos desde la feature 016."

## Overview

Today Vinylmania already pulls a lot of catalog and collection data from Discogs — each release's year, genres, styles, labels and artists, and each owned copy's condition and real date of entry into the Discogs collection — but that data is only ever shown on the individual detail page of a single record. This feature surfaces it at the collection level as a new **"Mi colección en cifras"** section with two blocks:

1. **Collection statistics** — totals and breakdowns (by decade, genre, style, label, most-present artists, and growth over time) computed **only from data already retrieved when the library loads**. This block makes no new Discogs requests.
2. **Estimated market value** — a per-disc estimate and a collection total, obtained from Discogs' authenticated *price suggestions by condition* endpoint, cross-referenced with each copy's real **media condition** (stored since feature 016) so each disc is valued for the state it is actually in. Records with no market data are excluded from the total rather than breaking it, and the summary states how many of the collection's records the estimate covers.

The section is an extension of the existing OAuth + Discogs collection domain: it requires a linked Discogs account (same token as the library), shows the same "necesitas enlazar tu cuenta" message when unlinked, and reuses the resilience and rate-limiting infrastructure already built in specs 029 and 040 for the many price-suggestion calls the valuation implies.

## Clarifications

### Session 2026-09-06

- Q: Should the estimated value be shown in a fixed currency for everyone or in the user's own Discogs currency? → A: The currency the user has configured in their Discogs account. Price suggestions are returned in that currency, so no conversion or exchange-rate source is involved; every figure on the screen uses that one currency.
- Q: On opening the section, does the valuation start on its own or wait for a user action? → A: It starts automatically and fills in progressively. The statistics block is usable immediately; the valuation total does not block that load and updates as per-disc estimates arrive.
- Q: How should the valuation treat a copy with no recorded media condition? → A: Exclude it from the total and count it among the records the estimate could not cover (reflected in the "estimado sobre X de Y" label). No default grade is assumed.
- Q: Is the "growth over time" chart per-period additions or cumulative collection size? → A: Both — per-period counts (records added each month/year) and a cumulative running total of collection size, shown together or toggled.
- Q: How are artists counted for the "most-present artist" stat, given "Various Artists" and multi-artist releases? → A: Exclude "Various Artists"; count only the primary (first credited) artist of each release, so each release contributes exactly one artist.
- Q: How is the valuation handled for very large collections (thousands of records)? → A: No cap. The valuation computes progressively over the whole collection, partial results persist (per-release price cache), and the first run for a large collection shows an explicit long-running / "come back later" state. No release is permanently left out by an arbitrary ceiling.
- Q: How long are the breakdown lists (genre, style, label, decade)? → A: Top N per breakdown (~10–15) with the remaining tail collapsed into an expandable "Otros (N)" entry; the decade breakdown, being naturally short, shows in full.
- Q: How is the per-disc valuation presented in the section? → A: Lead with the total estimated value and coverage label, plus a "most valuable records" highlight list. The full per-disc breakdown is available on expand / a secondary view, not the default.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - See my collection as statistics (Priority: P1)

A collector with a linked Discogs account and a loaded library opens the new "Mi colección en cifras" section. Without any extra loading beyond what the library already did, they see: the total number of records they own, and breakdowns by decade, by genre, by style, by label, the artist that appears most often (with a top list of the most-present artists), and a chart of how their collection has grown over time — month by month and year by year — based on the real date each copy entered their Discogs collection, so records they added directly on discogs.com are included. A collector who has not linked their Discogs account opens the section and sees the same "necesitas enlazar tu cuenta" message used in the library and the wantlist, with a way to go link it, and no statistics.

**Why this priority**: This block delivers immediate value from data the app already has in memory, needs no new external calls, and carries no dependency on the market-value block. It is a complete, shippable MVP on its own.

**Independent Test**: With a linked account whose library is loaded, open "Mi colección en cifras" and verify all six statistics (total, decade, genre, style, label, top artists, growth-over-time) render from the already-loaded collection with no additional Discogs catalog requests. With an unlinked account, verify only the link-account message is shown.

**Acceptance Scenarios**:

1. **Given** a linked user whose library is loaded with N records, **When** they open "Mi colección en cifras", **Then** the statistics block shows a total of N records and breakdowns by decade, genre, style, and label, each ordered by descending count.
2. **Given** a linked user, **When** the statistics block renders, **Then** it shows the artist that appears on the most records and a ranked list of the most-present artists.
3. **Given** a linked user who added a record directly on discogs.com (never touched in Vinylmania), **When** the growth-over-time chart renders, **Then** that record is counted in the month/year of its real Discogs date of entry, not the date it would have had in Vinylmania.
4. **Given** a signed-in user who has NOT linked their Discogs account, **When** they open "Mi colección en cifras", **Then** they see the same account-linking message used by the library and wantlist and no statistics or valuation content.
5. **Given** a linked user with an empty collection, **When** they open the section, **Then** they see a clear empty state rather than an error.
6. **Given** "Mi colección en cifras" exists, **When** the user views the primary navigation, **Then** it appears at the same level as "Mi biblioteca" and "Lista de deseos".

---

### User Story 2 - Know what my collection is worth (Priority: P2)

The same collector wants an estimate of what their collection is worth. The section's second block shows, for each disc, an estimated market value adjusted to the real condition of their copy (the media condition they recorded for that record), and a total estimated value for the whole collection. Because some releases have no market data (rare pressings, no recorded sales), those discs are left out of the total instead of breaking it, and the total is labelled with how many records it was computed over — for example "estimado sobre 42 de 50 discos". Every monetary figure on the screen is shown in one consistent currency.

**Why this priority**: This is the headline "collection in figures" number, but it depends on the section and the account link already existing (Story 1) and involves many external calls, so it ships after the zero-cost statistics block.

**Independent Test**: With a linked account and a library of known records with known media conditions, open the section, let the valuation compute, and verify each disc shows a per-condition-adjusted estimate, the total equals the sum of the covered discs, and the coverage label ("sobre X de Y") matches the number of discs that returned market data.

**Acceptance Scenarios**:

1. **Given** a linked user with a record whose media condition is recorded, **When** the valuation computes, **Then** that disc's estimate is the Discogs price suggestion for that exact condition grade.
2. **Given** a linked user whose collection has records with market data and records without, **When** the valuation computes, **Then** the total is the sum of only the records with market data, and the records without market data are excluded without any error.
3. **Given** the valuation has computed over 42 of 50 records, **When** the total is shown, **Then** it is labelled to indicate it was estimated over 42 of 50 records.
4. **Given** the valuation screen, **When** any monetary amount is displayed (per-disc or total), **Then** it is shown in the same single currency across the whole screen.
5. **Given** a linked user opening the section, **When** the screen loads, **Then** the statistics block is usable immediately and the valuation total does not block that initial load.
6. **Given** a record with no recorded media condition, **When** the valuation computes, **Then** that record is counted among the records the estimate could not cover (see Assumptions).
7. **Given** the valuation has computed, **When** the valuation block renders, **Then** it leads with the total estimated value and coverage label and a "most valuable records" highlight list, and the full per-disc breakdown is available on expand or a secondary view.

---

### User Story 3 - Valuation stays fast and safe at collection scale (Priority: P3)

A collector with a large collection (many dozens or hundreds of records) opens the section. Asking Discogs for a price suggestion per record could mean a burst of calls, so the valuation reuses the existing rate-limiting and resilience layers, caches the price suggestions with a longer window than the normal catalog cache (market value moves slowly), and computes the total progressively or on demand so the screen never hangs. Opening the section again soon after does not re-hit Discogs for prices that are still fresh.

**Why this priority**: A refinement of Story 2's behaviour under load. Story 2 is demonstrable on a small collection without it, but this is required before the feature is safe for real collections.

**Independent Test**: With a linked account and a 100+ record collection, open the section and verify: price-suggestion calls are paced by the existing rate-limit smoothing and never trip the circuit breaker; the screen stays responsive while the total fills in; re-opening the section within the cache window issues zero new price-suggestion calls.

**Acceptance Scenarios**:

1. **Given** a large collection, **When** the valuation runs, **Then** price-suggestion requests are paced by the existing rate-limit and retry infrastructure (specs 029, 040) and do not trip the circuit breaker.
2. **Given** the valuation is still computing, **When** the user looks at the screen, **Then** they see progress/partial results and can still read the statistics block and navigate.
3. **Given** the valuation computed the total, **When** the user re-opens the section within the price cache window, **Then** the total is recomputed with no new Discogs price-suggestion calls.
4. **Given** some price-suggestion requests fail transiently, **When** the valuation finishes, **Then** the affected discs are reported as not-yet-covered with a way to retry, and the rest of the total is still shown.
5. **Given** a user changed a copy's media condition (feature 016) while the price suggestion for that release is still cached, **When** the valuation recomputes, **Then** it uses the new condition against the cached per-condition suggestions without a new Discogs call.

---

### Edge Cases

- **Empty collection**: total is 0, breakdowns show an empty state, valuation shows "estimado sobre 0 de 0".
- **Release with no year**: grouped into an "Año desconocido" bucket in the decade breakdown but still counted in the overall total.
- **Release with no genre / style / label / artist metadata**: omitted from that specific breakdown, still counted in the total and in other breakdowns.
- **Multi-valued facets**: a release with two genres (or two labels) counts once in each matching bucket, so the sum of a breakdown can exceed the record count — this is expected and should be clear to the reader. (The artist stat is the exception: one artist per release — see FR-009.)
- **"Various Artists" compilation**: counted in the total and in the decade/genre/style/label breakdowns, but excluded from the most-present-artist stat.
- **Copy with no recorded media condition**: excluded from the valuation total and counted among the non-covered records (see Assumptions).
- **Price suggestion missing the exact recorded grade**: the disc is counted as not covered rather than substituting a different grade's price.
- **Very large collection (thousands of records)**: statistics still render from in-memory data; the valuation paces its calls and computes progressively with no cap, showing a long-running state on first run and reusing cached per-release suggestions on later visits.
- **Rate limit hit or Discogs outage mid-computation**: partial total is shown with the covered count; a graceful message explains the rest could not be computed, with retry — consistent with the project's resilience principles.
- **User navigates away while the valuation is computing**: no error; the in-progress work is abandoned or resumed from cache on return.
- **Discogs account currency changes between visits**: the screen stays internally consistent within a single view (see FR on currency).
- **Multiple copies of the same release in the Discogs collection**: each copy is counted once in the statistics and valued individually.

## Requirements *(mandatory)*

### Functional Requirements

#### Access & framing

- **FR-001**: The system MUST expose a "Mi colección en cifras" section reachable from the primary navigation at the same level as "Mi biblioteca" and "Lista de deseos".
- **FR-002**: Both blocks MUST require a linked Discogs account. An unlinked user MUST see the same "necesitas enlazar tu cuenta" message already used by the library and wantlist, with an action leading to the Discogs connection area, and MUST NOT see any statistics or valuation content.
- **FR-003**: The section MUST use the same Discogs OAuth token and authenticated collection access already used to load the library; it MUST NOT require any additional authorization step.

#### Block 1 — Collection statistics

- **FR-004**: The statistics block MUST be computed only from data already retrieved when the library loads — each release's year, genres, styles, labels and artists, and each copy's real date of entry into the Discogs collection. It MUST NOT issue any new Discogs catalog requests.
- **FR-005**: The block MUST show the total number of records in the collection.
- **FR-006**: The block MUST show a breakdown by decade, derived from each release's year, with releases of unknown year grouped separately (see Assumptions) but still included in the total.
- **FR-007**: The block MUST show a breakdown by genre and a separate breakdown by style. A release with multiple genres or styles counts once in each corresponding bucket.
- **FR-008**: The block MUST show a breakdown by label. A release with multiple labels counts once per label.
- **FR-009**: The block MUST identify the most-present artist and MUST show a ranked list of the most-present artists (top list; length per Assumptions). Each release contributes exactly one artist — its primary (first credited) artist. Releases credited to "Various Artists" are excluded from this stat.
- **FR-010**: The block MUST show the collection's growth over time using each copy's **real date of entry into the Discogs collection**, not the date the record was added from Vinylmania, so records added directly on discogs.com are counted. The view MUST present both perspectives — the number of records added in each period (per month and per year) and the cumulative running total of collection size over time — shown together or via a toggle.
- **FR-011**: Each breakdown MUST show a count per bucket and be ordered by descending count.
- **FR-011a**: The genre, style, and label breakdowns MUST show a top slice (approximately the 10–15 highest-count buckets) with the remaining buckets collapsed into a single expandable "Otros (N)" entry that preserves the full totals. The decade breakdown MUST be shown in full.
- **FR-012**: The statistics block MUST render without waiting on the market-value block.
- **FR-013**: An empty collection MUST produce a clear empty state, not an error.

#### Block 2 — Estimated market value

- **FR-014**: For each owned copy, the system MUST obtain the Discogs price suggestion by condition for its release and select the suggested value for the copy's recorded media condition (feature 016), producing a per-disc estimate adjusted to that copy's real state.
- **FR-015**: The system MUST compute an estimated value per disc and a total estimated value for the whole collection (the sum of the per-disc estimates that could be computed). The valuation block MUST lead with the total and coverage label (FR-017) plus a "most valuable records" highlight list; the full per-disc breakdown MUST be reachable on expand or a secondary view rather than shown by default.
- **FR-016**: A release for which Discogs returns no price suggestion (rare editions, no recorded sales) MUST be excluded from the total without raising an error, mirroring how a missing rating is handled in search results today.
- **FR-017**: The total MUST be labelled with the number of records it was computed over versus the collection total (e.g. "estimado sobre 42 de 50 discos").
- **FR-018**: A copy with no recorded media condition MUST be excluded from the valuation total and counted among the records the estimate could not cover (reflected in the coverage label of FR-017). No default condition grade may be assumed on the user's behalf.
- **FR-019**: Every monetary amount shown anywhere in the section (per-disc and total) MUST be expressed in the single currency the user has configured in their Discogs account. No currency conversion or exchange-rate source is used; releases whose price suggestion is returned in that currency are the ones valued.
- **FR-020**: Opening the section MUST NOT be blocked by the valuation. The valuation MUST start automatically when the section opens and fill in progressively as per-disc estimates arrive; the statistics block and navigation MUST be usable while it computes.

#### Block 2 — Resilience, caching & scale

- **FR-021**: Price-suggestion requests MUST reuse the existing Discogs resilience and rate-limiting infrastructure (retry, circuit breaker, rate-limit smoothing) from specs 029 and 040; the feature MUST NOT introduce a parallel request path that bypasses them.
- **FR-022**: Price suggestions MUST be cached with a longer time-to-live than the normal catalog cache, because market value changes slowly (default window per Assumptions).
- **FR-023**: While the valuation is computing, the section MUST remain usable (statistics readable, navigation possible) and MUST show progress or partial results.
- **FR-023a**: The valuation MUST NOT impose an arbitrary cap on the number of releases valued; it MUST compute progressively across the entire collection regardless of size. On the first run for a large collection (where computation cannot complete promptly), the section MUST show an explicit long-running state (e.g. "this may take a while — come back later") while partial results accumulate in the price cache and remain available on return.
- **FR-024**: Re-opening the section while cached price suggestions are still fresh MUST recompute the total without issuing new Discogs price-suggestion calls.
- **FR-025**: When some price suggestions cannot be retrieved due to transient failure or rate limiting, the affected discs MUST be reported as not-yet-covered with a way to retry, and the remainder of the total MUST still be shown. A full Discogs outage MUST produce a graceful message consistent with the project's observability/resilience principles, not a broken screen.
- **FR-026**: When a copy's media condition changes (via feature 016), the next valuation MUST reflect the new condition; if the release's per-condition suggestions are still cached, it MUST do so without a new Discogs call.

### Key Entities *(include if feature involves data)*

- **Collection Copy**: one owned instance of a release in the user's Discogs collection. Relevant attributes here: the referenced release, the recorded media condition, and the real date it entered the Discogs collection.
- **Release Catalog Facets**: the already-retrieved descriptive metadata of a release used for statistics — year, genres, styles, labels, artists.
- **Statistic Breakdown**: a named dimension (decade, genre, style, label, artist, entry month/year) with a list of buckets, each bucket having a label and a count.
- **Price Suggestion**: Discogs' suggested market value for a release, given per condition grade, in a currency.
- **Per-Disc Estimate**: the price suggestion value selected for a copy's recorded media condition; may be absent when there is no market data or no usable condition.
- **Collection Valuation Summary**: the total estimated value, the number of records covered, the collection total, and the currency.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A linked user whose library is already loaded can open "Mi colección en cifras" and see all six statistics breakdowns with no additional wait beyond the library load and no new Discogs catalog requests.
- **SC-002**: For a collection of up to 1,000 records, the statistics block is fully rendered within 2 seconds of opening the section.
- **SC-003**: A record added directly on discogs.com and never edited in Vinylmania appears in the growth-over-time chart in the calendar month of its real Discogs entry date, in both the per-period count for that month and the cumulative total from that month onward.
- **SC-004**: For a 50-record collection where 8 records have no market data, the valuation total is labelled "sobre 42 de 50" and equals the sum of those 42 per-disc estimates.
- **SC-005**: Opening the section a second time within the price-suggestion cache window computes the total with zero new Discogs price-suggestion calls.
- **SC-006**: Running the valuation for a collection of 100+ records completes without tripping the Discogs circuit breaker or exceeding rate limits, and the section stays responsive (statistics readable, navigation possible) throughout.
- **SC-007**: 100% of monetary figures on the screen are displayed in the same currency.
- **SC-008**: An unlinked user opening the section sees only the account-linking message and no statistics or valuation data.
- **SC-009**: When Discogs is unreachable during valuation, the section still shows the statistics block and a graceful, non-blocking message for the valuation, never an error page.

## Assumptions

- **Navigation**: "Mi colección en cifras" is a new top-level navigation entry, peer to "Mi biblioteca" and "Lista de deseos".
- **Data source for Block 1**: the statistics operate on the same synchronized collection dataset the library screen uses (sync-on-read with the existing ~5-minute cache window plus manual refresh). If the library has not been loaded in the session, opening the section performs that same sync-on-read; no separate or heavier fetch is introduced.
- **Real entry date**: each Discogs collection instance carries its real date of entry (`date_added`) and it is already present in the collection payload the library retrieves.
- **Unknown year**: releases with no year are shown in an "Año desconocido" group in the decade breakdown and still counted in the collection total.
- **Multi-valued facets**: genre, style, label and artist breakdowns count a release once per matching value, so a breakdown's bucket counts can sum to more than the record total; this is presented so it does not read as an inconsistency.
- **Top artists length**: the most-present-artists list defaults to the top 10.
- **Breakdown list length**: genre, style, and label breakdowns show ~10–15 top buckets plus an expandable "Otros (N)" remainder (FR-011a); the decade breakdown shows in full.
- **Missing media condition**: copies without a recorded media condition are excluded from the valuation and counted among the non-covered records (FR-018); no default grade is assumed.
- **Currency**: the valuation currency is whatever the user has configured in their Discogs account (FR-019); the screen does not offer a currency selector and performs no conversion.
- **Valuation trigger**: the valuation runs automatically on opening the section and updates progressively (FR-020); there is no "calculate" button.
- **Price cache window**: price suggestions are cached for approximately 7 days — materially longer than the normal catalog cache — and refreshed only after that window.
- **Per-disc visibility**: the valuation leads with the total, the coverage label, and a "most valuable records" highlight list; the complete per-disc breakdown is available on expand / a secondary view (FR-015).
- **Multiple copies**: if the Discogs collection holds more than one instance of the same release, each is counted once in statistics and valued individually.
- **No new persistence**: computed statistics and valuation are derived on demand and cached per the windows above; nothing is stored long-term in Vinylmania's own data store.
- **Price suggestions endpoint only**: the feature uses only the Discogs authenticated *price suggestions by condition* endpoint; the marketplace statistics endpoint (lowest price, number of copies for sale) is not used.

## Out of Scope

- Price-change alerts or notifications.
- A history of how the collection's estimated value evolves over time.
- Exporting or sharing the report.
- Comparing the collection or its value with other collectors.
- The Discogs marketplace statistics endpoint (lowest listed price, number of copies for sale).
- Any new Discogs catalog fetch for Block 1 beyond what the library already loads.
