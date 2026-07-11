# Data Model: Adopt New Vinylmania Logo Branding

This feature introduces no persisted entities, database schema changes, or API
contracts (per spec Assumptions: purely presentational, no backend involvement).
There is no `Key Entities` section in `spec.md` because the feature has no data
model — it replaces static brand assets/markup only.

The only structured "data" is component prop shapes for the new brand-mark
components, documented below for implementation reference, not as a domain model.

## Component prop shapes (not persisted)

### `VinylmaniaIcon` props

| Field | Type | Notes |
|---|---|---|
| `size` | `number` (px) | Base rendered width/height; the app header additionally applies a responsive override (28px below `md:`, 36px at `md:`+ — the same breakpoint `HeaderNavIcons`/the hamburger already switch at) so the header's own icon size responds to viewport without a JS branch; landing header uses a fixed 36px (no mobile variant needed, since it has no hamburger/nav-icon layout to stay in sync with); hero uses ~120px (nearest Tailwind scale step), per the brief's "general logo" reference |
| `className` | `string?` | Passthrough for layout/spacing classes at each call site |

Fill colors are not a prop — they're baked into the component via `dark:`
Tailwind classes (research.md §2), since every instance follows the same
light/dark mapping; no call site needs a different color scheme.

### `VinylmaniaWordmark` props

| Field | Type | Notes |
|---|---|---|
| `grunge` | `boolean` (default `false`) | `true` only for the landing hero's "general logo" (spec Clarifications); header/landing-header lockups always pass `false` |
| `className` | `string?` | Passthrough for font-size/letter-spacing at each call site (20px header vs. 34px+ hero, per the brief) |

Text content is fixed ("VINYLMANIA") — not a prop — since every placement that
shows a wordmark shows the same brand name (research.md §5).

### `VinylmaniaGrungeFilter`

No props — a single, static, visually-hidden SVG containing one `<filter
id="vm-wordmark-grunge">` definition, mounted once at the app root. Referenced
by `id` via inline `style={{ filter: 'url(#vm-wordmark-grunge)' }}` on any
`VinylmaniaWordmark` instance rendered with `grunge`.

## Existing entities/mechanisms reused unchanged

- **Theme state** (`ThemeContext`, `dark` class on `<html>`) — read-only;
  drives which `dark:`-classed fill colors render, exactly like every other
  themed element in the app. No changes to theme resolution logic.
- **Auth/navigation** (`AppHeader`'s existing `Link to="/app"`) — unchanged
  destination and behavior; only the link's visual content changes.
