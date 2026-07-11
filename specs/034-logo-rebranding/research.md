# Phase 0 Research: Adopt New Vinylmania Logo Branding

## 1. Icon implementation approach: hand-authored inline SVG, not an icon library

**Decision**: Build `VinylmaniaIcon` as a hand-authored inline SVG React component (200×200 viewBox, matching the design brief's `vm-icon`/`vm-icon-dark-bg` symbols), accepting a `size` (px) prop, rendered directly in JSX — no imported `.svg` asset file, no icon library dependency.

**Rationale**: This mirrors the codebase's only existing icon convention, confirmed in `frontend/src/components/HeaderNavIcons.tsx` (`ProfileIcon`, `WishlistIcon`, `LibraryIcon` — each a small local component returning raw `<svg>`, sized via Tailwind `h-4 w-4` classes, no icon package installed). No `.svg`/`.png` logo asset files exist anywhere in the repo today (only `frontend/public/favicon.svg`, a static file, and `frontend/public/icons.svg`, an unrelated sprite) — repeating this convention for the new brand icon keeps a single, consistent pattern.

**Alternatives considered**: Exporting the brief's `<symbol>` defs as a standalone `.svg` sprite file and referencing via `<use href="/brand-sprite.svg#vm-icon">` — rejected: adds a new asset-loading concern (sprite fetch, `<use>` cross-origin quirks) for no benefit over inline JSX, and breaks from the zero-icon-library convention already established.

## 2. Light/dark icon variant: one markup, CSS-driven, not two duplicated SVGs

**Decision**: `VinylmaniaIcon` renders ONE SVG markup whose fill colors are set via Tailwind `dark:` utility classes directly on the inner `<circle>`/`<text>` elements — Tailwind v4 auto-generates a `fill-*`/`dark:fill-*` utility for every `@theme` color token, exactly like the existing `bg-landing-surface`/`dark:bg-landing-surface` classes already used on `LandingHeader`. So the outer circle uses `fill-landing-surface dark:fill-brand-icon-dark-bg`, and the center circle uses `fill-landing-accent dark:fill-primary` — rather than rendering the brief's `vm-icon` and `vm-icon-dark-bg` symbols as two separate elements toggled by visibility classes.

**Rationale**: This matches the app's established dark-mode pattern everywhere else — a single element carries both light and dark Tailwind classes (e.g. `Card`'s `bg-white dark:bg-gray-950`), never a duplicated light/dark element pair. It also avoids doubling the icon's DOM size and keeps exactly one accessible-tree node per icon instance. The constitution's "Theme-variable dark mode" rule (`dark:` prefix + CSS variables in `@theme`) applies directly here.

**Alternatives considered**: Two full SVG elements (`vm-icon` shown via `dark:hidden`, `vm-icon-dark-bg` shown via `hidden dark:block`) — rejected: doubles markup for a difference that is *only* fill colors (same geometry, same "VM" glyph, same ring strokes), which the single-markup + `dark:fill-*` approach already covers completely.

## 3. Wordmark, grunge filter, and component split

**Decision**: `VinylmaniaWordmark` renders the literal text "VINYLMANIA" (matching the brief's all-caps markup) in the `font-display` theme token (mapped to `'Anton', sans-serif`), accepting a `grunge?: boolean` prop (default `false`). When `grunge` is true, it applies `style={{ filter: 'url(#vm-wordmark-grunge)' }}` — the exact CSS technique the brief itself uses (`filter:url(#grungeF)` on a plain `<span>`, not inside an SVG). The referenced `<filter>` lives in one shared, visually-hidden `VinylmaniaGrungeFilter` component (`feTurbulence` + `feDisplacementMap`, matching the brief's `#grungeF` exactly), mounted once at the app root (`App.tsx`) so every grunge-enabled wordmark instance references the same filter def rather than duplicating it.

Per the Clarifications session: `grunge` is `true` only for the landing hero's "general logo" wordmark; the app header and landing header lockups always render `grunge={false}` (clean typography, since the distortion isn't legible/intentional-looking at 20px).

`VinylmaniaIcon` and `VinylmaniaWordmark` are kept as two separate atoms (not one combined "logo" component) because the two placements arrange them differently: the header lockup is icon+wordmark side-by-side (horizontal `flex items-center gap-2`), while the hero's "general logo" is icon-above-wordmark (vertical `flex flex-col items-center gap-3`), per the brief's sections 1 and 2 respectively. A single configurable "logo" component covering both layouts would need a layout-direction prop for no real reuse benefit, since each call site already composes its own flex container.

**Rationale**: Matches Principle IV (SOLID) — each atom has one responsibility (icon, or wordmark text) — and Principle III (YAGNI) — no combined component config surface is built until a second identical-layout use case actually exists.

**Alternatives considered**: Embedding "VINYLMANIA" as SVG `<text>` alongside the icon in one big SVG per placement — rejected: the brief itself keeps the wordmark as separate HTML text (only the icon's small internal "VM" monogram is SVG `<text>`), and keeping the wordmark as real HTML text is what lets it satisfy accessible-name and `getByText` assertions "for free," per research.md §5.

## 4. New `@theme` tokens: reuse existing color tokens, add only what's missing

**Decision**: Add exactly two new tokens to `frontend/src/styles/global.css`'s `@theme` block:
- `--font-display: 'Anton', sans-serif;` (paired with the existing `--font-sans` token pattern)
- `--color-brand-icon-dark-bg: #1a1a22;` (the icon's dark-context outer-circle shade — the one color in the brief with no existing match)

Every other color the icon needs already exists as a token: the brief's light-context icon outer circle (`#0b0b10`) is exactly `--color-landing-surface`; the brief's amber center (`#f59e0b`) is exactly `--color-landing-accent`; the brief's dark-context center (`#4f46e5`) is exactly `--color-primary`. These are reused directly — no duplicate tokens are introduced for the same hex values.

**Rationale**: The exact hex-value matches (confirmed by inspecting `global.css:15,52-53`) are strong evidence the brief was designed against this app's existing palette; reusing the tokens keeps a single source of truth per color and satisfies the "CSS-first configuration"/"No custom CSS without justification" constitution rules — new values go in `@theme`, and no value is duplicated under a second name.

**Alternatives considered**: Defining a full parallel set of `--color-brand-*` tokens mirroring every brief color, even the ones that already match existing tokens — rejected: would create two names for the same color, an avoidable maintenance/drift risk the constitution's theme rules exist to prevent.

## 5. Accessible name strategy

**Decision**: The icon SVG is always `aria-hidden="true" focusable="false"` (purely decorative). Where the wordmark's real text ("VINYLMANIA") is visible (desktop header, landing header, hero), it already provides an accessible name/`getByText` match by itself — no extra `aria-label` needed there. The app header's brand `<Link>` additionally carries a static `aria-label="Vinylmania"` unconditionally (at both mobile icon-only and desktop icon+wordmark states), so its accessible name is identical and predictable at every viewport width without any conditional/responsive ARIA logic — this is what makes the icon-only mobile state (no visible text at all) satisfy FR-006 and keeps `e2e/tests/dark-mode-contrast.spec.ts:59`'s `page.getByRole('link', { name: 'Vinylmania' })` passing unchanged (Playwright's default substring, case-insensitive `name` match accepts "VINYLMANIA" or an `aria-label` of "Vinylmania" equally).

**Rationale**: A single, unconditional `aria-label` on the interactive header link is simpler and more robust than switching accessible-name strategy per breakpoint (Principle III, YAGNI) and gives every consumer (screen readers, Playwright's `getByRole`, RTL's `getByRole`) one predictable answer regardless of viewport.

**Alternatives considered**: Relying only on the visible wordmark text and leaving the mobile icon-only state with no accessible name — rejected: would regress accessibility at mobile widths, violating FR-006 and SC-002-adjacent existing e2e coverage.

## 6. Font loading strategy for "Anton" (no layout shift)

**Decision**: Load "Anton" via a `<link rel="preconnect">` + Google Fonts stylesheet `<link>` in `frontend/index.html` (mirroring the brief's own `<helmet>` snippet), using the `display=swap` parameter so text is never invisible while the font loads (no FOIT). Layout stability is achieved structurally, not through font-metric matching: every brand-mark container (header lockup, hero) is a flex row/column whose height is anchored by the icon's fixed pixel size (36px header, 120px hero) — not by the wordmark's text metrics — so a font swap only changes glyph shapes inside an already-fixed-height box, never the surrounding page layout. The app's existing body font (`--font-sans`, system stack) is unchanged; only the wordmark uses `--font-display`("Anton") — the brief's own use of "Inter" for its mockup's body text is not adopted, since the spec does not request changing the app's body typography (scope: wordmark only, per FR-010).

**Rationale**: Directly resolves the Clarifications session's font-adoption decision and the "no layout shift" edge case, using the simplest mechanism (fixed-height icon-anchored containers) rather than a more complex font-metric-override (`size-adjust`/`ascent-override` `@font-face` fallback) approach, which isn't needed once the container height no longer depends on the wordmark's own rendered size.

**Alternatives considered**: A custom `@font-face` fallback with `ascent-override`/`descent-override`/`size-adjust` tuned to match Anton's metrics — rejected as unnecessary complexity (Principle III) once the container-height-anchored-by-icon approach already prevents any visible reflow.

## 7. Favicon: single static SVG, no dark/light variant

**Decision**: Replace `frontend/public/favicon.svg` in place (same path, same `<link rel="icon" type="image/svg+xml">` reference in `index.html` — no `index.html` favicon-tag change needed) with a new standalone SVG derived from the brief's light-context `vm-icon` (200×200 viewBox cropped/optimized for small sizes, per the brief's "Monocromo & favicon" section's 32px/16px references), with colors hardcoded directly in the file (favicon SVGs render in browser-chrome isolation, without access to the page's Tailwind/CSS `dark:` classes).

**Rationale**: Matches the spec's Assumptions (favicon-only scope, no PWA manifest/multi-format work) and the brief's own favicon section, which only crops the light-context icon — confirming a single static variant is the intended design, not an oversight.

**Alternatives considered**: A `prefers-color-scheme` media query embedded inside the favicon SVG's own `<style>` block, to give browsers a dark-context favicon on dark OS/browser themes — rejected: inconsistent cross-browser support for in-SVG-favicon media queries, and the brief provides no dark favicon crop to base it on, so this isn't scoped by the design source of truth.

## 8. App header mobile/desktop breakpoint: reuse the existing `md:` switch, not a new one

**Decision**: In `AppHeader`, both the icon's size (28px below `md:`, 36px at `md:`+) and the wordmark's visibility (hidden below `md:`, shown at `md:`+) switch at the exact same `md:` (768px) breakpoint that `HeaderNavIcons` (`hidden ... md:flex`) and the hamburger trigger (`md:hidden`) already switch at — confirmed in `frontend/src/components/HeaderNavIcons.tsx:92` and `frontend/tests/unit/AppHeader.test.tsx:20-30`. `LandingHeader` (no hamburger/nav-icons of its own) uses a fixed 36px icon at every width, since it has no other header element it needs to stay visually in sync with.

**Rationale**: The whole `AppHeader` already reflows as one unit at `md:` — nav icons and the hamburger trade places at that exact width. Switching the brand mark's size/wordmark-visibility at a *different* breakpoint (e.g. `sm:`) would create a jarring in-between viewport range where the hamburger has already appeared but the wordmark hasn't disappeared yet (or vice versa). Reusing the same breakpoint keeps the header's mobile/desktop transition a single, coherent moment, consistent with the constitution's dual-layout requirement (v2.2.0).

**Alternatives considered**: A separate, narrower breakpoint (`sm:`, 640px) tuned just for the brand mark — rejected: introduces a second, independent breakpoint for one header, with no benefit over reusing the one already governing the rest of the header's layout.

## 9. Discovered during implementation: `HeaderSearchBox` width at 320px

**Decision**: Narrow `HeaderSearchBox`'s base (mobile) width from `w-40` (160px) to `w-28` (112px); `sm:w-64 md:w-80` unchanged.

**Rationale**: Not part of the original plan — discovered via a diagnostic e2e run during implementation. The old plain-text "Vinylmania" label used `truncate` (`overflow: hidden`), which gives a flex/grid item an automatic minimum width of 0, letting it silently shrink to absorb overflow. The app header's right side (hamburger + sign-out button, ~107px, no `truncate`) was *already* too wide for a 320px viewport once the search box's rigid 160px and the header's padding/gaps are accounted for — it only fit because the old brand column could compress arbitrarily. The new brand mark's `min-w-11` (44px, required for the touch-target rule) is a hard floor that no longer absorbs that slack, exposing the pre-existing tightness as a real horizontal-scroll regression (caught by `e2e/tests/dashboard-feed-grid.spec.ts`'s 320px check from feature 033). Narrowing the search box — which only needs to fit a short query string, not display it in full — restores headroom without touching the hamburger/sign-out button or the brand mark itself.

**Alternatives considered**: Reducing the header's horizontal padding (`px-4`) or gap (`gap-3`) — rejected: saves less width per change and would affect every header element's spacing, not just the one component that has genuine room to spare; shrinking the brand mark below its required touch target — rejected: would reintroduce the touch-target violation this feature exists to fix.
