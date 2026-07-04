# Phase 1 Data Model: Frontend Look-and-Feel Refactor

This feature introduces no domain data, storage, or API schema changes (see
Assumptions in spec.md). The "model" for a presentation-layer refactor is the design
system itself: the theme tokens, the atomic components built on them, and the
per-screen UI state machine that every data-dependent screen must implement
consistently. This document captures that model so Phase 2 tasks have a concrete,
shared vocabulary.

## 1. Theme Tokens (`@theme` variables)

Defined once in `frontend/src/styles/global.css`, consumed everywhere via generated
Tailwind utilities. No component may hardcode a hex/rgb value that duplicates one of
these.

| Token | Purpose | Notes |
|---|---|---|
| `--color-primary` | Single accent color (links, primary buttons, focus rings) | New value chosen during implementation (FR-009); not the current `#3d5afe` by requirement, but MAY coincide if that's the color chosen |
| `--color-surface` | Card/background surface color | Distinct value for light and dark (via `dark:` variant on consuming utilities, not a second token) |
| Neutral gray/slate scale | Text, borders, muted content | Tailwind's built-in neutral scale; no custom token needed unless a specific shade is missing |
| `--font-sans` | Base font stack | Carries forward the existing system-font stack from current `global.css` |
| `--spacing-*` (if any custom values needed) | Only added if a spacing value outside Tailwind's default scale is required | Default scale (`p-4`, `p-6`, `gap-4`, `space-y-4`, ...) should cover this feature; no custom spacing token is anticipated |

## 2. Atomic Components (`frontend/src/components/ui/`)

Each is a self-contained, single-responsibility module per Principle II, encapsulating
its own Tailwind classes so no visual pattern is hand-repeated across screens (FR-002).

| Component | Represents | Key Props (contract) | Used by |
|---|---|---|---|
| `Card` | The shared card surface (`rounded-xl`, `border`, `shadow-sm`/`shadow-md`, `p-4`/`p-6`) | `children`, optional `className`, optional `padding` (`"sm" \| "md"`, default `"md"`) | `RecordCard`, `RecordDetailPage`, `LibraryListPage` empty/error states, `AddRecordPage` result rows |
| `Button` | Primary interactive action | `children`, `onClick`, `type`, `disabled`, `loading`, `variant` (`"primary" \| "secondary"`) | `GoogleSignInButton`, `AppHeader` sign-out, `AddRecordPage` search/add actions, `RecordDetailPage` edit/save/remove |
| `Badge` | Small status label (e.g., record condition) | `children`, `tone` (`"neutral" \| "muted"`) | `RecordCard`, `RecordDetailPage` |
| `Avatar` | Circular image/initial placeholder (cover art, user avatar) | `src`, `alt`, `size` (`"sm" \| "md" \| "lg"`) | `RecordCard` cover art, `AppHeader` (if user avatar shown) |
| `Input` | Text/select/textarea form field wrapper with consistent label + control styling | `label`, `id`, standard input props via spread | `AddRecordPage` search field, `RecordDetailPage` condition/notes editing |
| `Skeleton` | Generic pulsing placeholder block | `className` (controls width/height via Tailwind sizing utilities), `rounded` (`"md" \| "full"`, default `"md"`) | Base primitive for `RecordCardSkeleton`, `RecordDetailSkeleton`, list/page-level skeletons |

Per-screen skeleton compositions (not separate primitives, but arrangements of
`Skeleton` + `Card`):

| Composition | Mirrors | Sizing source of truth |
|---|---|---|
| `RecordCardSkeleton` | `RecordCard` loaded state | Same `Card` padding + same cover aspect-ratio/height class as `RecordCard`'s `Avatar`/cover image |
| `RecordDetailSkeleton` | `RecordDetailPage` loaded state | Same heading/line-height classes and `Card` wrapper as the loaded detail layout |

## 3. Screen UI State Model

Every data-dependent screen (`LibraryListPage`, `RecordDetailPage`, and the search/add
flow within `AddRecordPage`) MUST model its content area as exactly one of these four
mutually exclusive states, each rendered at the same footprint (FR-005):

| State | Trigger | Rendering rule |
|---|---|---|
| `loading` | Request in flight, no cached data yet | Skeleton composition matching the shape of `loaded`, same `Card`/sizing classes |
| `empty` | Request succeeded with zero results | Same `Card`/sizing footprint as `loaded`, with empty-state copy instead of records |
| `error` | Request failed (e.g., catalog unavailable) | Same `Card`/sizing footprint as `loaded`, with error copy instead of records |
| `loaded` | Request succeeded with ≥1 result | Real content inside `Card`-based layout |

This is a UI rendering contract, not a persisted state machine — no transitions are
stored; each screen simply derives its current state from existing request state
(already present as React `useState` in each page) and picks the matching render
branch.

## Relationships

- `Card` is the structural basis for `RecordCard`, `RecordCardSkeleton`, and every
  page-level content container — one definition, reused everywhere (Principle II,
  FR-001/FR-002).
- `Skeleton` is the structural basis for both card-shaped and text-block-shaped
  loading placeholders, parameterized by size rather than duplicated per screen.
- Theme tokens are the single source powering both the light (default) and dark
  (`dark:`-variant) rendering of every atomic component, including skeletons
  (FR-006).
