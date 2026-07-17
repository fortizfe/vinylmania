# Phase 1 Data Model: Modo carátula / modo lista en Resultados de búsqueda y Mi biblioteca

This feature introduces no new persisted storage (no new Firestore
collection, no schema migration). It changes one existing API response
shape (additive, optional fields) and introduces one new purely
client-side, non-persisted-server-side preference value.

## 1. View-mode preference (client-only, not persisted server-side)

| Field | Type | Notes |
|---|---|---|
| `mode` | `'grid' \| 'list'` | Current presentation mode for one screen. |
| storage key | `'vinylmania:view-mode:search'` \| `'vinylmania:view-mode:library'` | One independent key per screen (FR-003), same `localStorage` mechanism as `THEME_STORAGE_KEY` in `frontend/src/theme/ThemeContext.tsx`. |

**Default**: `'grid'` when the key is absent or holds an unrecognized
value (FR-004) — mirrors `ThemeContext`'s `readStoredTheme() ?? fallback`
guard pattern, so a corrupted/old localStorage value never breaks the
page.

**Lifecycle**: read once on mount (lazy `useState` initializer); written
synchronously on every user toggle. No expiry, no server sync (Out of
Scope), no relationship to any other entity.

**Validation rule**: only the literal strings `'grid'` or `'list'` are
accepted when reading from storage; anything else is treated as absent
(falls back to default), the same type-narrowing-predicate approach
`ThemeContext.tsx` uses for `isTheme`.

## 2. `CatalogSearchResult` (extended) — frontend & backend domain

Existing type, gaining two new **optional** fields. Defined in two places
that must stay in sync (no shared package in this repo): backend
`backend/src/domain/discogsCatalog/types.ts` and frontend
`frontend/src/services/discogsApi.ts`.

| Field | Type | Change | Notes |
|---|---|---|---|
| `discogsId` | `number` | unchanged | |
| `resultType` | `'release' \| 'artist' \| 'master'` | unchanged | |
| `title` | `string` | unchanged | |
| `artist` | `string?` | unchanged | |
| `thumbnailUrl` | `string?` | unchanged | |
| `year` | `number?` | unchanged | |
| `formats` | `string[]?` | unchanged | Already an array; list mode now joins **all** entries (comma-separated) instead of using only `formats?.[0]` as the grid card does today (spec Assumptions / FR-007). |
| `communityRating` | `CommunityRating?` | unchanged | Reused as-is in list mode per FR-018. |
| `country` | `string?` | **NEW** | Single value, mirrors `Release.country` and `MasterReleaseVersion.country` shape. Absent → omitted in the row (FR-008), never rendered as `"undefined"`. |
| `labels` | `string[]?` | **NEW** | Array (Discogs' `/database/search` raw `label` field is itself an array — see `research.md` R3), **not** a singular `label`, so multiple labels display exactly like `formats` (comma-joined, FR-007). Absent/empty → omitted in the row. |

**Relationships**: unchanged — still one row per Discogs search hit.
`resultType: 'master'` results are mapped with the same universal,
type-agnostic logic as `year`/`formats` (no `master`-specific branching in
`mapSearchResult`) — verified against the existing mapper, which already
maps `year`/`formats` for masters when Discogs provides them. `country`
and `labels` follow that same precedent. The "aggregate, no single value"
framing in FR-012 is a **presentation** rule (list mode renders masters as
a simplified row regardless of what the mapped data contains), not a
mapping rule — `SearchResultListRow` simply never reads
`country`/`labels`/`formats`/`year` on the `isGrouped` branch.

**State/transition**: none — this is a read-only, per-request DTO, not a
stored entity.

## 3. Backend raw Discogs schema (adapter-internal, not exposed)

`rawSearchResultSchema` in `discogsMapper.ts`, extended:

| Raw Discogs field | Zod type | Change |
|---|---|---|
| `id` | `z.number()` | unchanged |
| `type` | `z.enum(['release','artist','master'])` | unchanged |
| `title` | `z.string()` | unchanged |
| `thumb` | `z.string().optional()` | unchanged |
| `cover_image` | `z.string().optional()` | unchanged |
| `year` | `z.union([z.string(), z.number()]).optional()` | unchanged |
| `format` | `z.array(z.string()).optional()` | unchanged |
| `country` | `z.string().optional()` | **NEW** |
| `label` | `z.array(z.string()).optional()` | **NEW** — raw Discogs field name is singular (`label`), but its value is an array; mapped to the domain's plural `labels` field. |

`mapSearchResult` extends its existing conditional-spread pattern:
`...(raw.country ? { country: raw.country } : {})` and
`...(raw.label?.length ? { labels: raw.label } : {})` — identical shape
to how `year`/`formats` are already handled, no new pattern introduced.

## 4. Existing entities reused unchanged

These are read, not modified, by this feature — listed here only to
document the data already available to the new list-mode row components:

- **`Release`** (`frontend/src/services/libraryApi.ts`) — already has
  `country?: string`, `labels: LabelCredit[]` (each with a `name`),
  `formats: FormatDescriptor[]` (each with a `name`), `artists:
  ReleaseArtistCredit[]` (each with a `name`). `RecordListRow` reads
  `release.labels.map(l => l.name)`, `release.formats.map(f => f.name)`,
  `release.artists.map(a => a.name)`, joining each list with `', '`
  (FR-007) — same join convention as the existing release detail page.
- **`EnrichedLibraryEntry`** — `catalogStatus: 'ok' | 'unavailable'`
  already gates the existing degraded-state rendering in `RecordCard`;
  `RecordListRow` reuses the same gate and the same fallback copy
  ("Couldn't load catalog details for this record right now.") per
  FR-010.

## Summary of changes by layer

| Layer | File | Change type |
|---|---|---|
| Backend adapter | `discogsMapper.ts` | Extend schema + mapper (§3) |
| Backend domain | `domain/discogsCatalog/types.ts` | Extend `CatalogSearchResult` (§2) |
| Backend application/route | `searchCatalogWithRatings.ts`, `discogsRoutes.ts` | No change — pass-through |
| Frontend service type | `services/discogsApi.ts` | Extend `CatalogSearchResult` (§2), mirror of domain type |
| Frontend new state | `hooks/useViewModePreference.ts` | New, client-only (§1) |
