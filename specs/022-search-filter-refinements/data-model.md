# Data Model: Search Filter Refinements

**Feature**: 022-search-filter-refinements

This feature refines two entities already introduced by feature 021; no new
persistent storage or Firebase schema changes are involved (both entities are
transient, request/URL-scoped state, not stored data).

## Search Filter Set (updated)

The collection of currently active filter values associated with a given search.

| Field  | Type       | Notes |
|--------|------------|-------|
| genre  | `string?`  | Free text, trimmed; unchanged from feature 021 (FR-006). |
| style  | `string?`  | Free text, trimmed; unchanged from feature 021 (FR-006). |
| format | `string[]` | Zero or more values, each a member of the fixed `FORMAT_OPTIONS` list (see below). Empty array is equivalent to the filter being unset (FR-005). Replaces feature 021's single free-text `format: string`. |

**Removed**: `artist` (feature 021's fourth field) is no longer part of this
entity at all — not present in the frontend `SearchFilters` type, not recognized
by the backend's filter-parsing, and not reflected in the URL (FR-001, FR-009).

**Wire representation**: On the results-screen URL and in the backend request,
`format` is still carried as a **single string** — the selected array values are
joined with `,` before being placed in the `format` query parameter (both the
app's own URL and the outbound Discogs request), per the feature's clarification
and FR-011. The array shape exists at the UI/state boundary only; parsing back
from the URL splits on `,`, trims each part, and drops any part not found in
`FORMAT_OPTIONS` (FR-010).

## Format Option (new)

One entry in the fixed list of standard format names a user can choose from.

| Field | Type     | Notes |
|-------|----------|-------|
| label | `string` | The canonical Discogs format name (e.g. "Vinyl", "CD", "Cassette"). Doubles as its own identifier — no separate id field needed since the list is small, static, and string-keyed end-to-end (URL params, Discogs `format` param, checkbox `value`). |

**Fixed list** (static, curated, ~33 values — see `research.md` for sourcing):
Vinyl, CD, Cassette, CDr, File, DVD, Box Set, 8-Track Cartridge, Flexi-disc, All
Media, VHS, Reel-To-Reel, DVDr, Blu-ray, Lathe Cut, Shellac, Laserdisc, Acetate,
PlayTape, 4-Track Cartridge, Blu-ray-R, SACD, Memory Stick, Minidisc, Betamax,
Betacam SP, Floppy Disk, Hybrid, U-matic, DCC, HD DVD, SelectaVision, VHD.

**Validation rule**: A `Format Option` is only ever considered "selected" if its
label matches (case-sensitive, exact string) an entry in the fixed list; this is
the basis for FR-010's graceful-drop behavior on old links.

## Relationships

- `Search Filter Set.format` is a subset of `Format Option.label` values (zero to
  all ~33). No entity owns/references the other beyond this containment — Format
  Option is a static reference list, not a stored/mutable record.
