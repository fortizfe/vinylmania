# Feature Specification: Search Filter Refinements

**Feature Branch**: `022-search-filter-refinements`

**Created**: 2026-07-07

**Status**: Draft

**Input**: User description: "Vamos a afinar un poco más los filtros. Lo primero vamos a eliminar el filtro por artista ya que no tiene sentido por ahora. Lo segundo vamos a afinar el control para filtarr por format. Lo que quiero es que deje de ser texto libre y se tenga que seleccionar un elemento de la lista adjuntada en la imagen a este mensaje. Debe admintirse selección múltiple"

## Clarifications

### Session 2026-07-07

- Q: When a user selects more than one format value, how should the multi-format matching be technically satisfied against the existing search integration, which forwards `format` to Discogs as a single string value? → A: Send all selected format values as a single combined value in the existing `format` search parameter (e.g. comma-joined) in one request — no new parallel-request architecture. (Superseded by the entry below once live verification during implementation showed this combined request narrows results rather than widens them.)
- Q: Live verification against the real Discogs API during implementation (feature 022, T014) showed that a comma-joined `format` value (e.g. `format=Vinyl,CD`) returns only releases matching **all** of the selected formats simultaneously (AND), not releases matching **any** of them (OR) — confirmed by comparing item counts (`format=Vinyl` alone: 868 items; `format=CD` alone: 1756 items; `format=Vinyl,CD` combined: 14 items, each a release genuinely available in both formats, e.g. a box set). Given this, how should the feature behave? → A: Accept AND semantics as the real, final behavior, and update this spec (User Story 1, Acceptance Scenario 3, FR-004, SC-002, Edge Cases, Assumptions) to describe format selections as narrowing to releases available in ALL selected formats together, rather than widening to releases matching ANY of them. This preserves the single-request architecture (FR-011) and keeps rate-limit exposure unchanged, at the cost of the originally-intended OR behavior.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Select one or more formats from a fixed list (Priority: P1)

A user wants to narrow search results to specific physical or digital formats (e.g. Vinyl, CD, Cassette). Instead of typing a format name freehand and risking typos or invalid values, they pick from a predefined, standard list of format names and can select more than one at a time to narrow results down to releases available in all of the selected formats together (e.g. a "Vinyl" + "CD" box set).

**Why this priority**: This is the core value of this refinement — it replaces an error-prone free-text field with a reliable, guided selection, and is the larger of the two changes requested.

**Independent Test**: Open the format filter, select two format values (e.g. "Vinyl" and "CD"), apply the filters, and confirm results include only releases available in all of the selected formats together.

**Acceptance Scenarios**:

1. **Given** a user has an active search, **When** they open the format filter, **Then** they see a fixed list of standard format names to choose from, with none pre-selected by default (unless already active from a previous selection).
2. **Given** a user selects a single format value (e.g. "Vinyl") and applies the filters, **When** results are returned, **Then** only releases matching that format are shown.
3. **Given** a user selects multiple format values (e.g. "Vinyl" and "CD") and applies the filters, **When** results are returned, **Then** only releases available in all of the selected formats simultaneously are shown (not releases matching just one of them) — confirmed against live Discogs behavior during implementation (feature 022, T014).
4. **Given** a user has one or more formats selected, **When** they deselect all of them and apply the filters, **Then** the format filter no longer narrows the results (same as no format filter being active).
5. **Given** a user has previously selected format values, **When** they navigate away and back to the search results (e.g. via pagination, reload, or a shared link), **Then** the same format values remain selected.

---

### User Story 2 - Artist filter is removed (Priority: P2)

A user opening the search filter control no longer sees a field to filter by artist, since that filter did not provide reliable value in its current form.

**Why this priority**: A simplification with a smaller footprint than User Story 1, but it changes what users see, so it needs its own verification.

**Independent Test**: Open the search filter control and confirm no artist filter field is present, while the main search query box (used to search by any term including artist names) continues to work unaffected.

**Acceptance Scenarios**:

1. **Given** a user opens the search filter control, **When** they view the available filters, **Then** they see only Genre, Style, and Format — no Artist field.
2. **Given** a user previously had an artist value active (e.g. from a bookmarked or shared results link created before this change), **When** they open that link, **Then** the page loads normally and simply ignores the obsolete artist value, without showing an error.

### Edge Cases

- What happens when a bookmarked/shared results link includes an old free-text format value that no longer matches any option in the fixed list (e.g. a typo, or a value that was never a valid format)? → The unrecognized value is ignored (dropped) rather than causing an error; recognized values in the same link remain applied.
- What happens when a bookmarked/shared results link includes an obsolete artist value? → Ignored gracefully, per User Story 2's acceptance scenario 2.
- What happens when a user selects every available format value? → Under confirmed AND-matching semantics, results narrow to releases simultaneously available in ALL ~33 formats at once — in practice this yields very few or zero results, behaving like an overly restrictive filter rather than like no filter at all. This is expected behavior given how format selections combine, not a bug.
- What happens when the filtered (format-only or combined) search returns no matches? → The existing "no results, filters are active" messaging continues to apply, now naming the active Genre/Style/Format selections (format shown as the selected value(s), e.g. "Vinyl, CD").

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The search filter control MUST NOT include an Artist filter field.
- **FR-002**: The Format filter MUST present a fixed, predefined list of standard format names for the user to choose from (the same list referenced in this feature's supplied image), rather than accepting free-text input.
- **FR-003**: Users MUST be able to select more than one format value at the same time.
- **FR-004**: When one or more format values are selected, results MUST include only releases matching all of the selected values simultaneously (confirmed against live Discogs behavior during implementation, feature 022 T014 — a comma-joined `format` request narrows rather than widens results).
- **FR-005**: Deselecting all format values MUST be equivalent to the format filter not being active at all (excluded from the search criteria).
- **FR-006**: The Genre and Style filters MUST continue to behave exactly as already specified (free-text entry, combined with Format and the search query per existing rules) — this feature does not change them.
- **FR-007**: The set of currently selected format values MUST be reflected in the results screen's URL, so that reloading or sharing the URL reproduces the same selection and results.
- **FR-008**: Selecting or deselecting format values MUST NOT by itself trigger a new search; applying the updated format selection MUST continue to require the existing explicit "Apply filters" action.
- **FR-009**: A results link created before this change that includes an artist value MUST be handled gracefully — the value is ignored and no error is shown.
- **FR-010**: A results link that includes a format value not found in the fixed list MUST be handled gracefully — the unrecognized value is ignored and no error is shown, while any other valid, recognized values in the same link remain applied.
- **FR-011**: When multiple format values are selected, the system MUST submit them as a single combined search request (not one request per selected value), preserving the existing single-request search integration and avoiding multiplied upstream calls.

### Key Entities

- **Search Filter Set**: The collection of currently active filter values associated with a given search — now Genre (free text), Style (free text), and Format (zero or more values chosen from a fixed list). Artist is no longer part of this set.
- **Format Option**: One entry in the fixed list of standard format names a user can choose from (e.g. "Vinyl", "CD", "Cassette"). Each option is either selected or not; any number of options may be selected at once.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can select one or more format values without ever typing a format name, eliminating typo'd or invalid format filter values entirely.
- **SC-002**: 100% of format selections (none, one, or many values) produce a results list consistent with matching all of the selected values simultaneously.
- **SC-003**: Reloading or sharing a results URL with active format selections reproduces the identical selection and filtered results 100% of the time.
- **SC-004**: The search filter control shows no Artist field in 100% of visits to the search results screen.
- **SC-005**: Links created before this change (carrying an artist value and/or a now-invalid free-text format value) continue to load results without error 100% of the time.

## Assumptions

- The fixed list of format names is the standard set shown in the image supplied with this request (e.g. Vinyl, CD, Cassette, CDr, File, DVD, Box Set, 8-Track Cartridge, Flexi-disc, All Media, VHS, Reel-To-Reel, DVDr, Blu-ray, Lathe Cut, Shellac, Laserdisc, Acetate, PlayTape, 4-Track Cartridge, Blu-ray-R, SACD, Memory Stick, Minidisc, Betamax, Betacam SP, Floppy Disk, Hybrid, U-matic, DCC, HD DVD, SelectaVision, VHD) and is treated as a static, curated list maintained by the application, consistent with the earlier decision (feature 021) that no source exists to fetch these values dynamically.
- The per-format result counts shown in the reference image are specific to Discogs' own live catalog totals and are out of scope for this feature — the format list is presented without counts.
- Multiple selected format values are combined with "all of" (AND) logic within the Format filter itself, same as the Format filter as a whole combining with Genre and Style using "all of" (AND) logic (unchanged from feature 021) — e.g. Genre="Rock" plus Format="Vinyl, CD" returns Rock releases that are simultaneously available in both Vinyl and CD. This was originally intended as "any of" (OR) logic, but live verification against the real Discogs API during implementation (feature 022, T014) confirmed the single comma-joined `format` request Discogs' own integration already uses narrows results (AND) rather than widening them (OR); this spec was updated afterward to describe the verified, accepted behavior rather than the originally-intended one.
- Per FR-011, this AND-matching is achieved via a single combined request (e.g. joining selected values into the existing `format` search parameter) rather than one request per selected format — this keeps the single-request architecture and rate-limit exposure unchanged from feature 021, and was chosen over a per-value-request-and-merge approach specifically because that alternative would need multiple upstream Discogs calls per multi-format search plus approximate/non-exact pagination once results are merged.
- Removing the Artist filter only removes the dedicated Artist filter field; the main search query box (which can already be used to search by artist name as free text) is unaffected.
- The visual presentation of the format selection (e.g. an inline checklist vs. a separate picker) is an implementation detail to be decided during planning, not fixed by this specification.
