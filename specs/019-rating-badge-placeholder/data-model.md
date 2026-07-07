# Phase 1 Data Model: Placeholder Rating Badge for Unrated Releases

This feature is presentation-focused. It introduces no new persisted entities, no schema migrations, and no API contract changes. The "model" changes are limited to the shared rating-presentation helper's return contract and one new visual band.

## 1. Shared Rating Badge Presentation Model (updated)

This is a UI-only derived model, not a persisted entity. It extends the model introduced in feature 017 (`specs/017-record-rating-cards/data-model.md` §3).

| Field | Type | Derived from | Notes |
|---|---|---|---|
| `rawAverage` | `number \| undefined` | Search or library rating source | Used for band selection; absent when unrated |
| `displayValue` | `string` | `rawAverage`, or fixed | Compact one-decimal string (e.g. `4.2`) when rated; literal `-` when unrated |
| `band` | `'low' \| 'medium' \| 'high' \| 'unrated'` | `rawAverage` + visibility check | **CHANGED**: adds `'unrated'` as a fourth value |

**CHANGED — `presentRating` is now total, not partial**: `presentRating(rating)` (`frontend/src/lib/releaseRating.ts`) previously returned `RatingPresentation | null`, with `null` signaling "the caller should omit the badge." It now always returns a `RatingPresentation`. When the existing `isRatingVisible` check fails (rating absent, `count <= 0`, average non-numeric, or average outside `0-5` — the same set of conditions already used to represent a failed/timed-out lookup per feature 017 §2), it returns `{ displayValue: '-', band: 'unrated' }` instead of `null`.

Callers (`SearchResultCard.tsx`, `RecordCard.tsx`) drop their `rating && (...)` conditional and render `<ReleaseRatingBadge>` unconditionally with whatever `presentRating` returns.

### Band mapping (feature 017 bands unchanged; one new row added)

| Range / Condition | Band | Background token | Text color | Contrast ratio (≥4.5:1) |
|---|---|---|---|---|
| `0.00-2.50` | `low` | `--color-rating-low` (`#DC2626`) | white | 4.83:1 |
| `2.51-4.09` | `medium` | `--color-rating-medium` (`#FBBF24`) | near-black | 12.6:1 |
| `4.10-5.00` | `high` | `--color-rating-high` (`#15803D`) | white | 5.02:1 |
| No rating / invalid / lookup failed or timed out | **`unrated`** (NEW) | `--color-rating-unrated` (`#D1D5DB`, `dark:` `#4B5563`) | `text-gray-700` / `dark:text-gray-100` | 6.99:1 (light) / 6.86:1 (dark) |

See [research.md](./research.md) §1–§3 for the derivation, contrast computation, and rejected alternatives for the new row.

### Visibility rules (renamed from "omission rules" — nothing is omitted anymore)

Previously, the following conditions caused the badge to be omitted entirely. They now instead select the `unrated` band:

- Rating object is absent
- Rating `count <= 0`
- Average is not numeric
- Average is outside `0-5`
- (Search-result cards only) the per-release rating lookup failed or did not resolve within its 2-second timeout (feature 017 §2) — this already surfaces to the frontend as "rating object absent," so no new signal is needed.

## 2. Accessible label mapping (NEW)

| Band | `aria-label` |
|---|---|
| `low` / `medium` / `high` | `Rating ${displayValue} out of 5` (unchanged) |
| `unrated` | `Rating not available` (NEW) |

## 3. Unchanged inputs

The Search Result Card View Model and Library Card View Model (feature 017 §1–§2 — `CatalogSearchResult.communityRating`, `EnrichedLibraryEntry.release.community.rating`) are unchanged by this feature. No new fields are added to either contract; this feature only changes how the frontend renders the already-existing "absent/invalid" case.

## 4. State transitions

The feature adds no user-editable state transitions and no new loading state. The only change to existing UI state outcomes is:

1. Card data loads without a valid rating (or its lookup fails/times out).
2. **Before this feature**: no badge is rendered; the corner of the thumbnail is empty.
3. **After this feature**: the badge renders in the `unrated` presentation (`-` on soft gray) in the same position a numeric badge would occupy.

No card interaction flow changes — the badge remains non-interactive and secondary in both states.
