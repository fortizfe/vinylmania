# Data Model: Landing Page Refresh

This feature introduces no persisted entities, database schema changes, or API
contracts (per spec Assumptions: "No new backend data or API integration is
required"). There is no `Key Entities` section in `spec.md` because the feature
is purely presentational.

The only structured "data" is static UI content passed as component props —
documented below for implementation reference, not as a domain model.

## Static content shapes (component props, not persisted)

### `PillarSectionContent`

Used to render each of the three pillar sections (FR-007). Not stored anywhere;
defined as static data (e.g., a local array literal) consumed by a single
`LandingPillarSection` component.

| Field | Type | Notes |
|---|---|---|
| `id` | `'catalog' \| 'ratings' \| 'news'` | Stable key for React list rendering and test selectors |
| `icon` | inline SVG component | Per research.md §2 — hand-authored, no icon library |
| `title` | `string` | Short pillar name (e.g., "Your catalog, powered by Discogs") |
| `description` | `string` | One–two sentence supporting copy (static marketing text, not live data) |

No validation rules beyond standard React prop typing — this is presentational
copy, not user input.

## Existing entities reused unchanged

- **Authenticated user session** (`AuthContext`) — read-only, used only to
  decide the existing redirect-if-authenticated behavior (FR-006). No shape
  changes.
