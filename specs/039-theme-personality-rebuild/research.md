# Research: Theme Personality Rebuild (Light & Dark Mode)

**Feature**: `039-theme-personality-rebuild` | **Date**: 2026-07-12

This feature has no runtime unknowns (no new libraries, APIs, or data). "Research"
here means: finalizing the exact token values the spec left as
`NEEDS CLARIFICATION`-by-freedom ("Color freedom" assumption), verifying WCAG AA
for each new pairing, and drafting the constitution amendment the spec requires
(FR-011).

## 1. Neutral palette: warm-neutral (`stone`) replaces `gray`/`slate`

**Decision**: Use Tailwind v4's built-in `stone` color scale (already shipped,
no `@theme` override required) for all neutral surface/text/border utilities in
**light mode**, replacing every `gray-*`/`slate-*` utility 1:1 by shade number
(e.g. `bg-gray-50` → `bg-stone-50`, `text-gray-700` → `text-stone-700`,
`border-gray-200` → `border-stone-200`).

**Rationale**:
- Tailwind's default palette already includes `stone` (`stone-50` `#fafaf9`
  through `stone-950` `#0c0a09`) — no new `@theme` variables are needed for
  this scale, consistent with the constitution's "no custom CSS without
  justification" rule (default scale preferred over ad-hoc values).
- `stone-50` (`#fafaf9`) is visually equivalent to the logo design brief's
  `#f4f2ee` background — same warm-neutral family, no need to hand-author a
  duplicate scale.
- Shade-for-shade, `stone` sits at nearly identical lightness steps to `gray`
  (Tailwind's neutral families share the same lightness ramp, only hue
  differs), so every contrast ratio the app currently relies on for
  `gray-*` pairings carries over unchanged for `stone-*`. Verified explicitly
  for the two ratios the app leans on most (§4 below).

**Alternatives considered**:
- A hand-authored custom `--color-neutral-*` scale in `@theme` — rejected as
  unnecessary duplication of a scale Tailwind already ships (violates
  Principle III, Simplicity/YAGNI).
- Keeping `gray`/`slate` and only changing accents — rejected, contradicts
  FR-001 and the HU's explicit complaint ("today's generic gray/slate look").

**Exception**: `ThemeToggle`'s sun/moon switch previously used literal
`slate-*` for its night-sky gradient. Because this is a semantic sky-color
illustration (not a neutral surface token), it is migrated to the new dark
brand surface tokens (`--color-surface` / `--color-surface-raised`, §2) rather
than to `stone`, which both removes the last `slate-*` usage and reinforces
brand cohesion (the toggle's "night" now literally uses the app's own
near-black). No `gray-*`/`slate-*` exception is needed anywhere in the app.

## 2. Dark-mode surface: near-black brand tone, with an elevation step

**Decision**: Generalize the existing landing-only near-black
(`--color-landing-surface: #0b0b10`) into an app-wide token, and add one
elevated step for cards/modals sitting above the page background:

```
--color-surface:        #0b0b10   /* dark-mode page/app background (was --color-landing-surface) */
--color-surface-raised: #16161f   /* dark-mode card/modal background — one step lighter */
--color-border-dark:    #262631   /* dark-mode default border on stone/surface-raised */
```

`--color-brand-icon-dark-bg` (`#1a1a22`, feature 034) stays as-is for the icon
ring; it is close to but distinct from `--color-surface-raised` by design (the
icon ring is a fixed brand asset, not a reusable surface token) — no
consolidation forced.

Light mode uses `stone-50`/`stone-100` directly for page/card backgrounds (no
new token needed — see §1).

**Rationale**: FR-003 requires dark surfaces to use "a near-black base color
consistent with the one already used on the landing page and logo (or a tone
from the same family)" instead of generic `gray-950`/`gray-900`. Tailwind's
built-in `stone-950` (`#0c0a09`) is a warm brownish-black — a different family
from the brand's neutral-cool `#0b0b10` — so it does not satisfy "same
family"; a small dedicated dark-surface scale is kept instead of relying on
`stone-950`. Cards need one elevation step above the base or they'd be
visually indistinguishable from the page (`Card`, `Modal`, `AppHeader` all
currently rely on `gray-950` vs `gray-900`/`black` page background for this
same purpose).

**Alternatives considered**: Reusing `stone-900`/`stone-950` for dark
surfaces — rejected, fails the "same family as `#0b0b10`" requirement (FR-003)
and reintroduces exactly the "generic" look the HU is rebuilding away from.

## 3. Accent colors: indigo (primary) + amber (secondary), with a light-mode text exception

**Decision**: Generalize `--color-landing-accent` (`#f59e0b`, amber-500) into
an app-wide secondary accent token `--color-accent`, available outside the
landing page. `--color-primary` (`#4f46e5`, indigo) is unchanged and remains
the only primary-action color (FR-002).

Usage split (per Clarifications session 2026-07-12):
- **Indigo (`--color-primary`)**: primary CTA buttons, active/selected states,
  primary links, focus rings — unchanged from today, on every screen.
- **Amber (`--color-accent`)**: secondary emphasis — badges, hover accents,
  highlights, decorative brand moments (e.g. `ThemeToggle`'s sun, star-rating
  fill, section-header accent rules). Never replaces indigo as a primary
  action color.

**Contrast finding — amber needs a light-mode text variant**: `#f59e0b` text
on `stone-50` background measures **2.15:1**, below even the 3:1 large-text/
non-text minimum. `#f59e0b` as a *background* with dark text on top, or as an
icon/large accent on the **dark** surface, both clear AA comfortably (§4). So:

- `--color-accent` (`#f59e0b`) is used as-is for: dark-mode text/icons, and as
  a background fill (paired with `stone-900` text) in either mode.
- **`--color-accent-text` (`#b45309`, amber-700)** is added for the one
  remaining case — amber used as *foreground text or icon stroke color on a
  light-mode surface* (e.g. an amber label on a light card). This is a new,
  narrowly-scoped token, not a departure from "amber is the accent" — it is
  the same hue at a darker step, used only where light-mode contrast math
  requires it.

**Alternatives considered**: A single amber value everywhere — rejected, fails
WCAG AA in the one light-mode-text-on-light-surface case (verified below).
Restricting amber to backgrounds only (never text) — rejected as an
unnecessary constraint; darkening the token for that one case is simpler and
still "the same accent."

## 4. WCAG AA contrast verification

All ratios computed via the standard relative-luminance formula
(WCAG 2.1 §1.4.3). Pairings not listed here follow directly from the two
"anchor" ratios (light body text, dark body text) because `stone` and the
brand near-black scale preserve the same lightness steps the current
`gray`/`slate` usage already relies on.

| Pairing | Foreground | Background | Ratio | Use | Result |
|---|---|---|---|---|---|
| Light body text | `stone-900` `#1c1917` | `stone-50` `#fafaf9` | 16.7:1 | normal text | ✅ AA (4.5:1) |
| Dark body text | `stone-100` `#f5f5f4` | `--color-surface` `#0b0b10` | 18.0:1 | normal text | ✅ AA |
| Dark body text (card) | `stone-100` `#f5f5f4` | `--color-surface-raised` `#16161f` | 16.5:1 | normal text | ✅ AA |
| Light muted text | `stone-500` `#78716c` | `stone-50` `#fafaf9` | 4.59:1 | normal text | ✅ AA (matches existing `gray-500`-on-white margin) |
| Dark muted text | `stone-400` `#a8a29e` | `--color-surface` `#0b0b10` | 7.75:1 | normal text | ✅ AA |
| Amber accent, dark mode | `--color-accent` `#f59e0b` | `--color-surface` `#0b0b10` | 8.74:1 | text/icon/large | ✅ AA |
| Amber background + dark text | `stone-900` `#1c1917` | `--color-accent` `#f59e0b` | 7.79:1 | badge/pill text | ✅ AA |
| Amber accent, light mode text | `--color-accent` `#f59e0b` | `stone-50` `#fafaf9` | 2.15:1 | normal/large text | ❌ fails — use `--color-accent-text` instead |
| Amber text variant, light mode | `--color-accent-text` `#b45309` | `stone-50` `#fafaf9` | 4.81:1 | normal text | ✅ AA |
| Indigo primary + white text | `#ffffff` | `--color-primary` `#4f46e5` | 6.29:1 | button text | ✅ AA (unchanged, feature 032) |
| Hover border, light mode | `--color-accent-text` `#b45309` | `stone-50` `#fafaf9` | 4.81:1 | non-text border (3:1) | ✅ AA |
| Hover border, dark mode | `--color-accent` `#f59e0b` @60% | `--color-surface-raised` `#16161f` | 3.77:1 | non-text border (3:1) | ✅ AA |

**Edge case resolution (non-default states)**: Disabled controls are exempt
from WCAG 1.4.3 ("Inactive user interface components... have no contrast
requirement") — no verification needed. Error states reuse existing,
unmodified semantic error colors, out of FR-010's "introduced or modified"
scope. Hover/focus-visible states using new tokens are covered by the two
rows above (focus rings reuse `--color-primary`, already verified).

Rating bands (`--color-rating-low/medium/high`, `--color-rating-unrated`) are
explicitly out of scope (FR-009) and keep their existing feature-017-verified
ratios unchanged.

**Verification methodology for implementation**: because the neutral-scale
swap is mechanical (§1) and every *new* pairing is enumerated above, no new
automated contrast-audit tooling is introduced for this feature — the
existing manual verification approach (as used in specs 017/019/032/034) is
sufficient. `quickstart.md` includes a manual spot-check pass across all 10
screens + header in both modes as the acceptance gate for SC-003.

## 5. Display typography (`Anton`) scope and layout-shift strategy

**Decision**: Extend `--font-display` (Anton) from wordmark-only to also cover:
page headers, dashboard/landing pillar-section headers, and single-record
showcase titles (Record/Release/Master Release Detail page titles) — per the
Clarifications session. It explicitly does **not** apply to repeated per-item
titles in dense lists/grids (Search Results cards, Library grid cards), body
text, labels, or data values.

**Layout-shift mitigation**: The existing wordmark avoids CLS by having its
container sized by the icon, not the font — that trick doesn't generalize to
free-standing page headers. Instead, heading elements using `font-display`
MUST pair a fixed Tailwind `text-*`/`leading-*` utility (e.g. `text-3xl
leading-tight`) so the line box height is fixed by the utility class, not by
the font's rendered metrics. `font-display: swap` (already the loading
strategy for Anton, `index.html`) then only causes *horizontal* glyph-width
reflow during the FOUT→Anton swap, never a vertical line-count/height change,
which is what CLS measures. This is the same "no layout shift" principle the
constitution already mandates for skeletons, applied to font swapping instead
of async data.

**Alternatives considered**: `size-adjust`/`font-metrics` fallback tuning to
match Anton's metrics exactly — rejected as unnecessary precision (Principle
III) once the fixed-line-height approach already eliminates the only kind of
shift that matters (vertical).

## 6. Border/shadow "texture and character"

**Decision**: No new shadow tiers are introduced. `shadow-sm` remains the
default for in-flow cards; `shadow-md` is additionally permitted for
interactive/hover states on cards (already allowed by the unchanged
"Card-based layout" rule); `shadow-lg`/`shadow-xl`/`shadow-2xl` remain
reserved for floating elements (modals), unchanged. "Texture and character"
comes from:
- Swapping the flat, low-contrast `gray-900`-on-`gray-950` dark borders for
  the new `--color-border-dark` (`#262631`), which is deliberately a visible
  step lighter than `--color-surface-raised`, giving cards a defined edge
  instead of nearly invisible hairlines.
- Using the amber accent as a hover/focus border treatment on interactive
  cards and section headers: `hover:border-accent-text` in light mode
  (`#b45309` on `stone-50` = 4.81:1, ✅ AA non-text) and
  `dark:hover:border-accent/60` in dark mode (`#f59e0b`/60% on
  `--color-surface-raised` = 3.77:1, ✅ AA non-text) — raw `--color-accent`
  at any opacity fails 3:1 against light-mode `stone-50` (§4), so the two
  modes MUST use different accent tokens for this treatment, satisfying the
  "hover accents" part of FR-002 without new CSS.
- The existing grunge SVG filter (`VinylmaniaGrungeFilter`) stays scoped to
  large-format wordmark placements only, per its established feature-034
  scope — this HU does not expand grunge texture usage (matches the HU's
  "out of scope: no new illustrative imagery" note).

**Alternatives considered**: Increasing default border width app-wide (e.g.
`border-2`) — rejected as a blunt, low-value change; the color-contrast fix
above already achieves a "more defined" feel without touching every
component's box model.

## 7. Constitution amendment (FR-011)

**Decision**: Amend the "Visual lightness" bullet and add one clause to the
"Theme-variable dark mode" bullet, both inside "UI Design System & Styling",
leaving every other rule in that section (card layout, atomic components,
skeletons, no-layout-shift, dual responsive layout, touch targets, v4-current
utilities, no-custom-CSS) untouched, per FR-011/SC-005.

Drafted replacement text (applied to `.specify/memory/constitution.md` as an
implementation task, with its own `Sync Impact Report`):

> - **Visual lightness & brand personality**: Layouts MUST use the spacing
>   scale generously (`gap-4`, `space-y-4`, `p-6`); typography MUST rely on
>   `font-medium`/`font-semibold` for hierarchy rather than heavy bold
>   weights, except page headers, dashboard/landing section ("pillar")
>   headers, and single-record showcase titles, which MUST use the brand's
>   display typeface (`--font-display`, Anton) per the layout-shift rule
>   below — never body text, labels, data values, or repeated per-item titles
>   in dense lists/grids; the color palette MUST stay defined in `@theme` and
>   MUST use the warm-neutral (`stone`) family — not cool `gray`/`slate` —
>   for backgrounds, text, and borders, plus at least two brand accents
>   (`--color-primary` indigo as the primary-action color everywhere, and
>   `--color-accent` amber for secondary emphasis: highlights, badges, hover
>   accents, decorative brand moments) rather than a single reduced accent;
>   shadows MUST stay soft (`shadow-sm`/`shadow-md`) for in-flow cards,
>   reserving `shadow-lg`/`shadow-xl`/`shadow-2xl` for floating elements such
>   as modals.
>
> Append to **Theme-variable dark mode**: Dark mode's primary and elevated
> surfaces MUST use the brand's near-black tokens (`--color-surface`,
> `--color-surface-raised`) rather than a generic `gray-950`/`gray-900`.
> Headings using `--font-display` MUST pair a fixed `text-*`/`leading-*`
> utility so font-swap reflow never changes line-box height (no cumulative
> layout shift), consistent with the "No layout shift" rule above applied to
> font loading instead of async data.
>
> Replace **Skeleton loading states**: Any content that depends on an
> asynchronous request MUST show a skeleton loader built with Tailwind
> utilities (`bg-stone-200`/`dark:bg-surface-raised`, `animate-pulse`,
> `rounded-md`) that mirrors the exact shape and dimensions of the final
> content (same card structure, same approximate number of lines/blocks).
> Generic spinners and blank screens MUST NOT be used as the default loading
> state.

**Version bump**: MINOR, `2.3.0` → `2.4.0` — a materially expanded/modified
existing section (not a new principle, not a backward-incompatible governance
change), matching the precedent set by the `2.2.0` → `2.3.0` bump for the
changelog-automation rule change.

**Alternatives considered**: A MAJOR bump — rejected, this modifies rule
*text* within an existing section without removing or redefining a Core
Principle (I–VII), which is what the governance policy reserves MAJOR for.
