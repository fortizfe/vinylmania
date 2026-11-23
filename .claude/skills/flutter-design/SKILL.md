---
name: flutter-design
description: How to design and build Vinylmania UI in Flutter (flutter_app/, desktop + Android + iOS) — porting the web design system (brand tokens, Anton display type, stone/indigo/amber palette, motion tokens, press/focus feedback, skeletons) into ThemeData and shared widgets, adaptive compact/expanded layouts, platform idioms per OS, the installed Apple design skills translated to Flutter, and the accessibility gates (Semantics, 44/48 targets, contrast, text scaling, reduced motion). Use before building, restyling or reviewing any widget or screen in flutter_app/.
---

# Flutter design — Vinylmania

Same product, same brand as the web (`frontend/src/styles/global.css` is the
source of the values), adapted to each platform's conventions. Constitution
§X (WCAG 2.1 AA) and §XI (Apple design principles) apply to every screen; the
"Native clients" stack entry carries the Tailwind rules' intent over to Flutter.

## 1. Apple skills, translated

Same table as `frontend-design` §1 (`apple-design` for screens/gestures/sheets/
depth/typography, `emil-design-eng` for polish, `animate` for motion,
`review-animations` to review motion). Their output is CSS/web-flavoured:
translate it — CSS curve → `Cubic`, transition → `AnimatedFoo`/`AnimationController`,
spring → `SpringSimulation`, `backdrop-filter` → `BackdropFilter`,
`:active` → pointer-down state in `Pressable`, `prefers-reduced-motion` →
`MediaQuery.disableAnimationsOf(context)`.

## 2. Tokens — defined once in `lib/ui/core/theme/`

Port, don't reinvent (one class per file):

| Web token | Value | Flutter home |
|---|---|---|
| `--color-primary` | `#4F46E5` (dark-mode text: `--color-primary-text` `#818CF8`) | `ColorScheme.primary` |
| `--color-accent` / `--color-accent-text` | `#F59E0B` / `#B45309` (amber text on light) | `ColorScheme.tertiary` + `VinylmaniaColors` extension |
| `--color-surface` / `--color-surface-raised` / `--color-border-dark` | `#0B0B10` / `#16161F` / `#78716C` | dark `ColorScheme.surface` / `surfaceContainer` / `outline` |
| stone neutrals | Tailwind `stone-50…950` | light surfaces, text, borders (no cool greys) |
| `--color-rating-low/medium/high/unrated` | `#DC2626` / `#FBBF24` / `#15803D` / `#D1D5DB` | `VinylmaniaColors` extension |
| `--font-sans` | system UI font | Flutter's default per platform (SF / Roboto / Segoe UI) — don't bundle |
| `--font-display` | Anton, `tracking -0.02em`, `leading 1.05` | bundled asset (OFL), only page headers, pillar headers, single-record titles |
| `--ease-out` / `--ease-in-out` / `--ease-drawer` | `Cubic(0.23,1,0.32,1)` / `Cubic(0.77,0,0.175,1)` / `Cubic(0.32,0.72,0,1)` | `MotionTokens` |
| `--motion-duration-press/fade/collapse/drawer` | 130 / 200 / 200 / 250 ms | `MotionTokens` |
| `spring.default/sheet/momentum` | 0.4 s bounce 0 / 0.35 s bounce 0 / 0.5 s bounce 0.2 | `MotionTokens` springs (`SpringDescription`) |

Custom values go through a `ThemeExtension` (`VinylmaniaColors`,
`MotionTokens`), read via `Theme.of(context).extension<…>()`. No hex literal,
`Duration` or `Curve` outside `ui/core/theme/`. Light and dark `ThemeData`
both exist from day one; follow the system setting unless the user's saved
preference (backend `themePreference`) says otherwise.

## 3. Shared widgets — `lib/ui/core/widgets/`

Mirror `frontend/src/components/ui/` so both clients speak the same language:
`VmButton` (primary/secondary/icon), `VmCard`, `VmBadge`, `VmAvatar`,
`VmTextField`, `Skeleton`, `StarRating`, `ReleaseRatingBadge`, `Pressable`
(scale 0.97 on pointer-down, 0.99 for cards, reduced-motion → no scale),
`FocusRing` (visible 2 px primary ring on keyboard focus, desktop). Build one
only when a screen needs it; once a styling combination appears twice, it
becomes one of these.

## 4. Layout: two purpose-built layouts

- Breakpoint on the window, not the device: `MediaQuery.sizeOf(context).width` — **compact < 840** (phones, narrow windows) vs **expanded ≥ 840** (tablets landscape, desktop).
- Each screen = `XxxScreen` choosing between `XxxCompactLayout` and `XxxExpandedLayout`; both consume the same ViewModel.
- Compact: single column, bottom `NavigationBar`, thumb-zone actions, modal bottom sheets, no horizontal scroll of primary content.
- Expanded: `NavigationRail` / sidebar, multi-column grids, master-detail where it fits, hover states, a sensible window minimum size.

## 5. Platform idioms (adapt behavior, keep the brand)

- **iOS / macOS**: Cupertino back-swipe and scroll physics (defaults — don't override), `.adaptive` constructors for switches/sliders, haptics via `HapticFeedback.selectionClick` on discrete changes (iOS).
- **Android**: system back / predictive back via `PopScope`, Material ripple is replaced by `Pressable` feedback for brand consistency.
- **Desktop**: keyboard first — `Shortcuts`/`Actions` for search (`⌘/Ctrl+K`), `Esc` closes overlays, `SystemMouseCursors.click` on pressables, right-click only where it adds value, text selectable where users expect to copy (tracklists, catalog numbers).

## 6. Loading, empty, error

- Async content shows `XxxSkeleton` mirroring the final shape with the same size constraints → zero layout shift. No `CircularProgressIndicator` as a loading state.
- `Skeleton` pulses only when animations are enabled.
- Errors show a user-facing message and a real retry button; internals never shown.

## 7. Accessibility gate (merge blocker)

- Every control has a semantic label (`Semantics`, `tooltip` on icon buttons, `semanticLabel` on images); decorative images `excludeFromSemantics`.
- Targets ≥ 44×44 logical px on iOS, ≥ 48×48 dp on Android (`kMinInteractiveDimension`).
- Contrast ≥ 4.5:1 text, ≥ 3:1 UI, in both themes; state never by color alone.
- Text scaling to 200 % without clipping or overflow (test with `MediaQuery(textScaler: TextScaler.linear(2))`).
- Keyboard and switch access: logical `FocusTraversalGroup` order, visible focus, no traps; overlays return focus on close.
- Async updates the user must know about: `Semantics(liveRegion: true)` or `SemanticsService.announce`.
- Reduced motion: `MediaQuery.disableAnimationsOf(context)` → no scale/slide, opacity only or none.
- Widget tests assert the built-in guidelines on every screen:
  `await expectLater(tester, meetsGuideline(androidTapTargetGuideline));`
  plus `iOSTapTargetGuideline`, `labeledTapTargetGuideline`, `textContrastGuideline`.

## 8. Build order

Read the matching web screen and its spec → pick Apple skill(s) → decide
compact and expanded layouts → failing widget tests (states × layouts × a11y
guidelines) → build from `ui/core` widgets and tokens → run this checklist.
