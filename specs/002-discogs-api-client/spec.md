# Feature Specification: Discogs Catalog Client & Data Model

**Feature Branch**: `002-discogs-api-client`

**Created**: 2026-07-03

**Status**: Draft

**Input**: User description: "Quiero crear en el backend, un cliente http usando axios (propon otra opción si lo consideras más adecuado) para explotar la api. Recoge toda la información que necesites de la documentación oficial alojada en https://www.discogs.com/developers/. Especial atención en caminos como buscar información de las releases o los artistas. También quiero que propongas un modelo de datos para la librería sobre el que se mapeen los datos obtenidos de discogs. Todos los tests deben superar al final del desarrollo."

## User Scenarios & Testing *(mandatory)*

<!--
  This feature is backend infrastructure (per the constitution's Vinyl Data
  Source principle, Discogs is the required source of all vinyl/release
  metadata). It has no UI of its own yet, but it exists to make the
  end-user-visible capabilities below possible for upcoming features.
-->

### User Story 1 - Find the right release or artist by searching (Priority: P1)

A collector (via a future search feature built on top of this capability)
looks up a record or artist by name and sees a short list of relevant
Discogs catalog matches to choose from, instead of having to already know an
exact catalog identifier.

**Why this priority**: Search is the entry point to everything else — a
collector rarely knows a Discogs release/artist ID up front. Without search,
nothing downstream (viewing details, adding a record to a collection) can
begin.

**Independent Test**: Call the backend capability with a free-text query
(e.g., an album title or artist name) and confirm it returns a short list of
plausible matches sourced from Discogs, distinguishing release matches from
artist matches.

**Acceptance Scenarios**:

1. **Given** a query that matches a well-known release title, **When** a
   release search is performed, **Then** the matching release(s) appear in
   the results with enough summary information (title, year, format) to
   recognize the right one.
2. **Given** a query that matches a well-known artist name, **When** an
   artist search is performed, **Then** the matching artist(s) appear in the
   results.
3. **Given** a query with no matches in Discogs' catalog, **When** a search
   is performed, **Then** the result is a clearly empty result set, not an
   error.

---

### User Story 2 - View full details of a specific release (Priority: P1)

Once a specific release has been identified (e.g., picked from search
results), the system retrieves its full catalog information — artist(s),
label, year, format, tracklist, cover art, genres/styles — mapped into
Vinylmania's own consistent data shape.

**Why this priority**: Full release detail is the actual payoff of
searching — it's what a collector needs to confirm "this is my copy" and,
eventually, add it to their library. Ties directly to the constitution's
requirement that release metadata come from Discogs.

**Independent Test**: Call the backend capability with a known Discogs
release identifier and confirm the full detail (artists, label, tracklist,
images, etc.) comes back mapped into Vinylmania's internal release shape.

**Acceptance Scenarios**:

1. **Given** a valid, existing Discogs release identifier, **When** its
   detail is requested, **Then** the system returns the release mapped into
   Vinylmania's internal data model, including its artist(s), label(s),
   format, year, and tracklist.
2. **Given** a release identifier that doesn't exist in Discogs, **When**
   its detail is requested, **Then** the system reports a clear "not found"
   outcome rather than a generic error.
3. **Given** a release whose Discogs record is missing optional information
   (e.g., no cover image, incomplete tracklist), **When** its detail is
   requested, **Then** the system still returns the rest of the mapped data
   without failing.

---

### User Story 3 - View full details of a specific artist (Priority: P2)

Once a specific artist has been identified, the system retrieves their
full catalog information — name, profile, known aliases, image — mapped
into Vinylmania's own data shape.

**Why this priority**: Valuable for browsing an artist's body of work and
disambiguating similarly-named artists or aliases, but secondary to actually
identifying and viewing a release, which is the core collector need.

**Independent Test**: Call the backend capability with a known Discogs
artist identifier and confirm the full detail comes back mapped into
Vinylmania's internal artist shape.

**Acceptance Scenarios**:

1. **Given** a valid, existing Discogs artist identifier, **When** their
   detail is requested, **Then** the system returns the artist mapped into
   Vinylmania's internal data model, including name, profile, and any known
   aliases.
2. **Given** an artist identifier that doesn't exist in Discogs, **When**
   their detail is requested, **Then** the system reports a clear "not
   found" outcome rather than a generic error.

---

### Edge Cases

- What happens when a search query is empty or extremely short? The system
  MUST handle it without crashing (e.g., an empty/invalid-query outcome
  rather than forwarding a meaningless request).
- How does the system handle a release or artist ID that is well-formed but
  does not exist in Discogs? MUST be distinguishable from a technical
  failure (see User Stories 2 & 3, scenario 2).
- How does the system handle Discogs rate-limiting a burst of requests
  (e.g., several collectors searching at once)? MUST NOT crash the backend;
  MUST be logged with enough detail to diagnose, and MUST surface a
  distinguishable "temporarily unavailable, try again" outcome to callers.
- How does the system handle Discogs being slow or temporarily unreachable?
  MUST fail gracefully with a generic, user-safe error while logging the
  real cause internally (Principle V).
- What happens with a release that has multiple artists (a collaboration) or
  is credited to "Various Artists"? The internal model MUST support more
  than one artist per release.
- What happens with an artist that is actually a group, or is an alias of
  another artist entry? The internal model MUST be able to represent known
  aliases without treating them as unrelated, separate artists.
- What happens with non-Latin characters or special characters in titles or
  names (Discogs catalogs releases from every region)? MUST be preserved
  and returned as-is, not mangled or stripped.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST support searching the Discogs catalog by a
  free-text query, and MUST support scoping a search to releases only or to
  artists only.
- **FR-002**: The system MUST retrieve full details for a specific release
  identified by its Discogs release identifier.
- **FR-003**: The system MUST retrieve full details for a specific artist
  identified by its Discogs artist identifier.
- **FR-004**: The system MUST map all retrieved Discogs data into
  Vinylmania's own internal data model (see Key Entities) rather than
  exposing Discogs' raw response shape to the rest of the application.
- **FR-005**: The system MUST identify itself distinctly on every request
  to Discogs, per Discogs' API usage requirements, rather than sending
  anonymous or generic requests.
- **FR-006**: The system MUST respect Discogs' documented request-rate
  limits; when a limit is hit, the system MUST surface a clear, distinct
  "temporarily unavailable" outcome rather than crashing or silently
  discarding the request.
- **FR-007**: The system MUST treat "release/artist not found in Discogs" as
  a distinct, expected outcome (not an application error), so that calling
  features can show an appropriate "no such record" message.
- **FR-008**: The system MUST NOT fabricate or hand-author release/artist
  data when Discogs has no match — consistent with the constitution's
  requirement that all vinyl/catalog data originate from Discogs.
- **FR-009**: The system MUST log enough detail on any failed Discogs
  request (cause, identifier involved) to diagnose the issue without
  attaching a debugger, while any error surfaced to a caller MUST stay
  generic and free of internal detail (Principle V; Additional
  Constraints).
- **FR-010**: The internal data model MUST tolerate Discogs records with
  missing optional fields (e.g., no cover image) without failing the whole
  mapping.

### Key Entities

- **Catalog Search Result**: A lightweight summary entry returned by a
  search — enough to recognize and pick the right match (e.g., title,
  primary artist name, year, format, a small thumbnail, and whether it's a
  release or an artist match) without yet being the full detail record.
- **Release**: A specific cataloged edition of a recording — the actual
  record a collector owns or wants. Includes its title, year, country, one
  or more artists, one or more labels (with catalog number), format(s)
  (e.g., Vinyl, 12", 33⅓ RPM), genres/styles, a tracklist, cover images, and
  a link back to its Discogs entry. May belong to a broader "Master"
  grouping (see below) if the same recording has multiple pressings.
- **Master Release**: The canonical grouping of a Release across all of its
  different pressings/reissues/editions. Represented here only as a
  reference on a Release (its grouping identifier), not as its own
  separately-fetchable feature in this version.
- **Artist**: A musician or group as cataloged by Discogs — name, real name
  (if different from stage name), profile/biography, known aliases or name
  variations, an image, and a link back to its Discogs entry.
- **Track**: A single song within a Release's tracklist — its position,
  title, and duration.
- **Label**: The record label that issued a Release, including the
  catalog number assigned to that specific release. Represented as part of
  a Release's data; not a standalone lookup capability in this version.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A search for a well-known release or artist returns relevant
  results in under 3 seconds under normal conditions.
- **SC-002**: 100% of releases and artists successfully found in Discogs are
  returned in Vinylmania's own consistent data shape, regardless of missing
  optional fields in the source record.
- **SC-003**: 100% of searches or lookups for something Discogs has no
  record of return a clear "not found"/"no results" outcome, never a
  generic failure.
- **SC-004**: 100% of Discogs unavailability or rate-limit incidents are
  captured in logs with enough detail to diagnose after the fact, while the
  caller only ever sees a generic, safe message.

## Assumptions

- This feature delivers the backend capability (catalog client + internal
  data model) only. A user-facing search screen/endpoint that calls into it
  is a separate, future feature.
- The backend authenticates to Discogs using a single, application-level
  credential representing Vinylmania as a whole (not a distinct credential
  per end user). Obtaining/configuring that credential is a setup concern
  (similar to the Firebase credentials in the previous feature), not part
  of this feature's functional scope.
- Caching of Discogs responses is out of scope for this version, consistent
  with the Simplicity/YAGNI principle; the constitution already allows
  adding it later if performance requires it.
- "Search releases or artists" refers to Discogs' general catalog search,
  scoped by result type. Deep filtering (by genre, year, label, etc.) beyond
  a basic text query is not required for this version.
- Label lookups are not a standalone capability in this version — label
  name and catalog number already arrive embedded in release data.
- The specific HTTP client library used to call Discogs (e.g., axios or an
  alternative) is an implementation decision to be made and justified during
  planning, not a specification concern.
