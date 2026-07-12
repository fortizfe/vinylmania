# Data Model: Theme Personality Rebuild

**Feature**: `039-theme-personality-rebuild` | **Date**: 2026-07-12

This feature has no application data model (no Firestore documents, no API
payloads — FR-012/FR-013 explicitly keep business logic and data untouched).
The "entities" here are the **design tokens** the rebuild introduces or
changes in `frontend/src/styles/global.css`'s `@theme` block, and the rules
governing how components consume them. This doc is the contract components
and pages are built against during implementation.

## Token groups

### 1. Neutral scale (warm-neutral, replaces `gray`/`slate`)

| Token | Source | Notes |
|---|---|---|
| `stone-50` … `stone-950` | Tailwind v4 built-in | No `@theme` entry needed. Used directly as `bg-stone-*`, `text-stone-*`, `border-stone-*`, `dark:bg-stone-*`, etc. |

**Rule**: Every existing `gray-*`/`slate-*` utility in `frontend/src` is
replaced by the same shade number of `stone-*` (mechanical swap), **except**
where the existing usage targets the dark-mode base/raised surface or its
border (those move to the new tokens in group 2, not to `stone-950`/`stone-900`
— see research.md §2), and except semantic/functional colors (rating bands,
group 3) which are untouched.

### 2. Dark-mode brand surface (new `@theme` tokens)

| Token | Value | Replaces | Usage |
|---|---|---|---|
| `--color-surface` | `#0b0b10` | `--color-landing-surface` (renamed/generalized) + `dark:bg-gray-950` app-wide | Dark-mode page/app background |
| `--color-surface-raised` | `#16161f` | `dark:bg-gray-950`/`dark:bg-gray-900` on cards, modals, header | Dark-mode card/modal/header background — one elevation step above `--color-surface` |
| `--color-border-dark` | `#262631` | `dark:border-gray-900`/`dark:border-gray-800` | Dark-mode default border on `Card`, `Input`, `Checkbox`, `AppHeader`, etc. |

`--color-landing-accent` is renamed/generalized to `--color-accent` (group 3);
any remaining landing-only reference to `--color-landing-surface` becomes
`--color-surface`. `--color-brand-icon-dark-bg` (`#1a1a22`) is unchanged
(distinct fixed brand-icon asset color, not a reusable surface token).

Light mode uses `stone-50`/`stone-100` directly (group 1) — no light-mode
surface token is added.

### 3. Brand accents

| Token | Value | Role |
|---|---|---|
| `--color-primary` | `#4f46e5` (unchanged) | Primary-action color everywhere: main CTA buttons, active/selected states, primary links, focus rings. |
| `--color-accent` | `#f59e0b` (generalized from `--color-landing-accent`) | Secondary emphasis: badges, hover accents, highlights, decorative brand moments. Valid as background (any mode) or as dark-mode text/icon. |
| `--color-accent-text` | `#b45309` (new) | Amber as *foreground text or icon stroke* on a **light-mode** surface only — the one case where raw `--color-accent` fails WCAG AA (research.md §3–4). |

### 4. Semantic/functional colors (unchanged)

| Token | Value | Notes |
|---|---|---|
| `--color-rating-low` | `#dc2626` | Unchanged (FR-009) |
| `--color-rating-medium` | `#fbbf24` | Unchanged |
| `--color-rating-high` | `#15803d` | Unchanged |
| `--color-rating-unrated` | `#d1d5db` | Unchanged; its `dark:bg-gray-700` companion class in `ReleaseRatingBadge` moves to the equivalent `stone-700` per group 1's mechanical swap (still not a `--color-*` token, matching today's pattern). |

### 5. Typography

| Token | Value | Scope |
|---|---|---|
| `--font-sans` | unchanged | Body/UI text everywhere (unchanged) |
| `--font-display` | `'Anton', sans-serif` (unchanged value) | **Scope widened**: wordmark (existing) **+** page headers, dashboard/pillar-section headers, single-record showcase titles (Record/Release/Master Release Detail page titles). Still never body text, labels, data values, or repeated per-item titles in dense lists/grids (Search Results cards, Library grid cards). |

**Rule**: Any element newly using `font-display` MUST also carry a fixed
`text-*`/`leading-*` Tailwind utility (research.md §5) to prevent CLS during
the Anton font swap.

## Component → token relationships

| Component | Tokens it must consume after rebuild |
|---|---|
| `Card` | `stone-200`/`--color-border-dark` (border), `stone-50`/`--color-surface-raised` (background) |
| `Button` | `--color-primary` (primary variant), `stone-*`/`--color-border-dark` (secondary/outline variant) |
| `Badge` | `stone-*` (neutral tone), `--color-accent`/`--color-accent-text` (accent tone, new) |
| `Avatar` | `stone-*` fallback background |
| `Input` | `stone-*` border/background/text, `--color-primary` focus ring |
| `Modal` | `--color-surface-raised` (dark background), `stone-*` (light background/text) |
| `Checkbox` | `stone-*` border, `--color-primary` checked state |
| `Skeleton` | `stone-200`/`stone-800`-equivalent pulse background (no dedicated skeleton token — same mechanical swap as group 1) |
| `StarRating` | `--color-accent` filled state (was `amber-400` literal — consolidates onto the token) |
| `ReleaseRatingBadge` | Group 4 tokens only (unchanged pairings) + `stone-*` for the unrated dark-mode companion class |
| `AppHeader` | `stone-*` (light), `--color-surface-raised`/`--color-border-dark` (dark) |
| `ThemeToggle` | `--color-surface`/`--color-surface-raised` for the night-sky gradient (replaces literal `slate-*`), `--color-accent` for the sun (unchanged, already token-equivalent) |
| Page-level headers (all 10 pages) | `font-display` + fixed `text-*`/`leading-*` for titles in scope (research.md §5); `stone-*`/`--color-surface*` for surfaces |

No new component props/state are introduced by this table — it is a
class-level (Tailwind utility) mapping, not a new API surface, consistent
with FR-006's "no hardcoded gray/slate colors" requirement and Principle III
(no speculative abstraction beyond what the token swap requires).
