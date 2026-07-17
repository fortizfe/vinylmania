# Phase 0 Research: Modo carátula / modo lista en Resultados de búsqueda y Mi biblioteca

No unresolved `NEEDS CLARIFICATION` markers remain in the Technical
Context (see `plan.md`) — the stack is fully fixed by the constitution
(React/TypeScript frontend, Express/TypeScript backend, hexagonal
architecture, Firebase, Discogs, Tailwind CSS v4) and every open product
question was already resolved either in `.hu/search-library-grid-list-view-toggle.md`
or in the spec's `## Clarifications` session. This document records the
technical decisions made while translating the spec into an implementation
approach.

## R1: Where to persist the view-mode preference

**Decision**: A single generic hook, `useViewModePreference(storageKey:
string)`, backed directly by `window.localStorage` — no React Context.

**Rationale**: `frontend/src/theme/ThemeContext.tsx` already implements the
exact read-on-init/write-on-change pattern needed
(`readStoredTheme()` → `useState(() => value ?? fallback)` → a setter that
writes through to `localStorage`), but it is a `Context` because theme is a
single, app-wide, remotely-synced (Firebase) value consumed by many
components. View-mode preference is the opposite: two independent,
purely-local, page-scoped values (`vinylmania:view-mode:search`,
`vinylmania:view-mode:library`), each consumed by exactly one page
component. A plain hook parameterized by storage key avoids adding two
near-duplicate Contexts (or one Context with a screen-key parameter, which
would need Provider nesting per page for no benefit) and matches the
existing `frontend/src/hooks/` convention (`useLibraryQueryParams.ts`,
`useSearchQueryParams.ts` are also page-scoped, non-Context hooks).

**Alternatives considered**:
- Reuse `ThemeContext`'s remote-sync layer (`useThemePreference.ts`) — rejected: that layer exists specifically for cross-device sync via Firebase, which is explicitly Out of Scope (spec: "Sincronizar la preferencia de modo entre dispositivos... es una ampliación futura").
- One shared Context holding both preferences — rejected: it would force `SearchResultsPage` to re-render on `LibraryListPage`'s preference changes (and vice versa) for no reason, and the spec explicitly requires the two preferences to be fully independent (FR-003).

## R2: Two-option toggle control pattern

**Decision**: A segmented control built as a `role="radiogroup"` wrapping
two `role="radio"` `<button>` elements (`aria-checked`, one `tabIndex=0`
per WAI-ARIA radio-group keyboard pattern), styled with hand-rolled inline
SVG icons (grid icon, list icon) — not the boolean-switch pattern used by
`ThemeToggle.tsx`.

**Rationale**: `ThemeToggle.tsx` is a `role="switch"` because dark/light is
a true binary on/off. Grid and list are two equally-weighted, named
alternatives (closer to a tab pair), so a switch's implied semantics
("on" vs "off") would be misleading to screen reader users. A two-button
radiogroup is the standard accessible pattern for this ("choose exactly
one of two named options") and still lets each option be reached and
activated independently via arrow keys / Tab, satisfying FR-015.
`ThemeToggle`'s `min-h-11 min-w-11` (44px) sizing, `focus-visible:ring-2`
treatment, and `clsx`-driven active/inactive class toggling are reused
directly for each of the two buttons.

**Alternatives considered**:
- Cloning `ThemeToggle`'s single-button sliding-switch look — rejected per above (wrong ARIA semantics for two named, non-binary options).
- A native `<select>` — rejected: fails the "indicates visually which option is active at a glance" acceptance criterion (spec US1 AC3) as well as the existing app's hand-built-control convention.

## R3: Backend mapping of `country`/`label` for search results

**Decision**: Extend `rawSearchResultSchema` in
`backend/src/adapters/discogsCatalog/discogsMapper.ts` with
`country: z.string().optional()` and `label: z.array(z.string()).optional()`
(array, not a single string), matching Discogs' actual
`/database/search` raw response shape. `mapSearchResult` exposes `country`
unchanged (string) and joins/derives a display-ready label list the same
way `formats` is already handled today (`formats?: string[]` — i.e. expose
`labels?: string[]` on `CatalogSearchResult`, not a singular `label`, for
symmetry with the existing plural `formats` field and with `Release.labels`
already used by `RecordCard`'s data).

**Rationale**: Discogs' `/database/search` endpoint returns `label` as an
array of strings per result (differs from the flat, singular
`label`/`country` shape already captured by `rawMasterVersionSchema` for
the *masters/versions* endpoint, which is a different Discogs endpoint with
a different raw shape). Modeling `labels` as `string[]` on the frontend
type keeps it consistent with FR-007's requirement to display *all*
labels/formats/artists (comma-joined), and mirrors the existing
`formats?: string[]` field and the full `Release.labels` shape already
consumed by `RecordCard`/library detail pages — no new display convention
is introduced.

**Alternatives considered**:
- Only capture the first label (`label: z.string().optional()`, `res.label?.[0]`) — rejected: contradicts FR-007 (show all labels when more than one exists) and the spec's explicit assumption that list mode must show every label, not just the first, unlike today's grid card which only shows `formats?.[0]`.

## R4: Layer placement of the new backend fields (hexagonal architecture)

**Decision**: Add `country?: string` and `labels?: string[]` to both
`backend/src/domain/discogsCatalog/types.ts`'s `CatalogSearchResult` and
the mirrored frontend `frontend/src/services/discogsApi.ts`'s
`CatalogSearchResult`. `discogsMapper.ts` (adapter) is the only file that
reads the raw Discogs field names (`country`, `label`) and populates the
domain shape; `application/discogsCatalog/searchCatalogWithRatings.ts`
requires no change since it already passes `CatalogSearchResult` objects
through untouched while enriching with ratings; `discogsRoutes.ts`
(driving adapter) requires no change since it already spreads the full
result objects into the JSON response.

**Rationale**: This follows Principle VIII exactly — only the Discogs
adapter touches the raw third-party field names; domain/application code
is agnostic to where `country`/`labels` came from. No new port is needed
because no new infrastructure capability is introduced, only two more
fields flowing through an existing port (`DiscogsCatalogPort`'s existing
`search` method).

**Alternatives considered**: None seriously considered — this is a direct
application of the already-established pattern used for every other field
on `CatalogSearchResult`.

## R5: New row components vs. extending existing card components

**Decision**: New sibling components — `SearchResultListRow.tsx` and
`RecordListRow.tsx` — placed flat in `frontend/src/components/` next to
`SearchResultCard.tsx`/`RecordCard.tsx`, each accepting the same props
their card sibling already accepts (`{ result, searchPath, onAdd, adding,
added }` / `{ entry }`). The parent pages branch on view mode to choose
which sibling to render per item, reusing the same data-fetching,
infinite-scroll, and pagination logic unchanged.

**Rationale**: Matches the existing flat `frontend/src/components/`
convention (confirmed: no card/row variant subfolders exist for any other
dual-presentation component in this codebase). Because grid and list modes
never render simultaneously and share no DOM structure (card = vertical
image-on-top layout with CSS grid; row = horizontal flex layout), a single
component branching internally on a `variant` prop would need two entirely
different JSX trees gated by conditionals throughout — splitting into two
small, single-responsibility components is simpler (Principle III) and
keeps `SearchResultCard`/`RecordCard` (already tested, already used
elsewhere conceptually as "the grid item") completely unchanged and
lower-risk. Shared pure-formatting logic (e.g., "join formats/labels with
comma", "resolve cover URL or placeholder") is extracted into small
shared helpers to avoid duplicating that logic between card and row.

**Alternatives considered**:
- A single `variant: 'grid' | 'list'` prop on the existing card components — rejected: would roughly double the branching complexity of two already-nontrivial components (master/grouped handling, add-to-library states, unavailable-catalog fallback) for two visually unrelated layouts, violating Principle III (Simplicity/KISS).

## R6: `ResultCardActions` (Add to library) and `ReleaseRatingBadge` reuse

**Decision**: `SearchResultListRow` reuses the existing
`ResultCardActions` component unchanged for the "Add to library"
button/states, and reuses the existing rating-badge component unchanged
for the community-rating overlay (FR-018), only changing the surrounding
layout (flex row vs. card) each is placed in.

**Rationale**: Both components already encapsulate their own state/markup
independently of card layout; the research (`RecordCard`/`SearchResultCard`
review) found no card-specific styling baked into either component that
would prevent reuse in a row layout. Reusing them avoids duplicating the
adding/added/error state machine (Principle III) and keeps existing unit
tests for those components valid without change.

## R7: Testing approach

**Decision**: Follow existing conventions exactly — Vitest + RTL unit
tests for the two new row components and the new `ViewModeToggle`
component (inline object-literal mock data, `renderWithRouter`-style
helper, `getByTestId`/`getByRole`/`queryBy*` assertions, mirroring
`SearchResultCard.test.tsx`/`RecordCard.test.tsx`); Playwright e2e specs
extending `search-results-responsive.spec.ts` /
`library-list-responsive.spec.ts` (or new sibling specs) using the same
`page.route(...)` backend-mocking pattern and the same
`element.boundingBox()` 44px assertion pattern already used against
`ThemeToggle` in `profile-responsive.spec.ts`, applied to the new
`ViewModeToggle`. Backend: Jest + Zod-schema unit test for the extended
`rawSearchResultSchema`/`mapSearchResult`, following the existing
`discogsMapper.test.ts` conventions (per Principle I, Test-First).

**Rationale**: Constitution Principle I (Test-First) and the Development
Workflow gate (e2e required for any `frontend/` PR) apply unchanged; no
new testing tool or pattern is warranted for a purely additive,
presentation-layer feature.
