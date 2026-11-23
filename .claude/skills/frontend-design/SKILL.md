---
name: frontend-design
description: How to design and build Vinylmania UI — composes the installed Apple design skills (apple-design, emil-design-eng, animate, review-animations) with the project's own design system (Tailwind v4 @theme tokens, components/ui primitives, motion/ tokens and patterns, press/focus constants) and the constitution's merge gates (WCAG 2.1 AA, 44px targets, skeletons, no layout shift, dark mode, dual desktop/mobile layout). Use before building, restyling or reviewing any screen or component under frontend/src.
---

# Frontend design — Vinylmania

The Apple skills give the *judgment*; this repo already encodes most of the
*answers*. Reuse first, design second, invent last.

## 1. Which Apple skill, when

Load the one the task needs before deciding the design — not all of them:

| Task | Skill |
|---|---|
| New screen/flow, gestures, sheets, depth/materials, typography hierarchy | `apple-design` |
| Component polish, states, "why does this feel off" | `emil-design-eng` |
| Adding motion to something | `animate` (then map its output onto our tokens, §3) |
| Reviewing existing motion | `review-animations` |
| "What should animate here?" | `find-animation-opportunities` |
| Naming an effect | `animation-vocabulary` |

If a skill's recommendation conflicts with the rules below, the project rules
win (constitution §XI: Apple principles govern feel, never compliance floors).

## 2. Reuse before you build (ponytail rung 2)

- **Primitives** `src/components/ui/`: `Button` (+ its class helper for `Link`s), `Card`, `Badge`, `Avatar`, `Input`, `Checkbox`, `Modal`, `Skeleton`, `StarRating`, `ReleaseRatingBadge`, `InlineEditableField`, `BackLink`, `ThemeToggle`, `ViewModeToggle`, `icons/`.
- **Interaction constants**: `focusRing` (`ui/focusRing.ts`) is the only allowed focus-visible treatment; `pressable` / `pressableCard` / `pressableRow` / `pressableNudge` (`ui/press.ts`) are the only pressed states. Architecture tests fail the build otherwise.
- **Motion** `src/motion/` — the only module allowed to import `motion`. Use `Overlay`, `Sheet`, `m`, `AnimatePresence`, `useFocusTrap`, `useScrollLock`, `useRestoreFocus`, `usePrefersReducedMotion` from `src/motion`.
- **Patterns**: `src/motion/README.md` defines the 7 canonical patterns (`pressable`, `binary-switch`, `segmented-selector`, `multi-select-list`, `disclosure`, `dismissible-layer`, `chrome-material`). Every control is `pressable` + at most one of them. Read the README before building any control.
- **Filters**: `components/filters/` (`CollapsibleFilterPanel`, `SelectableListFilter`, `FilterActions`).
- **Data**: `services/*Api.ts` via `apiClient.ts` → `queries/*Queries.ts` (TanStack Query). Never fetch from a component; never call anything but our backend (§IX).

A utility string that appears twice becomes a component or a shared constant.
One React component per file, named after it (constitution §XII). Legacy files
exporting several (`landingPillarIcons.tsx`, `FeedArticleBoard.tsx`,
`ui/icons/WishlistIcon.tsx`) get split when touched, never extended.

## 3. Project tokens (don't invent values)

- Colors in `src/styles/global.css` `@theme`: `primary` (indigo, primary actions only), `accent` (amber; `accent-text` for amber text on light surfaces), `surface` / `surface-raised` / `border-dark` for dark mode, `rating-*`. Neutrals are `stone`, never `gray`/`slate`.
- Type: `font-sans` for everything; `font-display` (Anton) only for page headers, pillar headers and single-record showcase titles — always with fixed `text-*` + `leading-display` / `tracking-display`. Hierarchy via `font-medium`/`font-semibold`.
- Motion: `easing.out|inOut|drawer`, `motionDuration.press|fade|collapse|drawer`, `spring.default|sheet|momentum`, `dismiss.*` from `motion/tokens.ts` (or the mirrored `--ease-*` / `--motion-duration-*` CSS vars). A new curve/duration needs a reason in the spec and goes in both places (a test checks they match).
- Shadows: `shadow-sm`/`shadow-md` in flow; `shadow-lg+` only for floating layers.
- A value outside the Tailwind scale goes into `@theme`, not ad-hoc CSS. No `tailwind.config.js`. v4 names only (`bg-linear-*`, `outline-hidden`, …).

## 4. Build order

1. Read the screen's existing components and the spec/plan if any.
2. Pick the Apple skill(s) from §1; decide layout for **both** desktop (`lg:`/`xl:`, multi-column, uses the width) and mobile (single column, thumb zone, sheets) — two layouts, not one that reflows.
3. Write the failing Vitest + RTL test first (query by role/label; assert states, keyboard and a11y names) — see the `test-first` skill.
4. Build from primitives; skeleton component (`XxxSkeleton.tsx`) mirrors the final shape with identical sizing classes.
5. Run the checklist below; `npm run lint && npx vitest run <file>`.

## 5. Merge-gate checklist (reviewers reject on any miss)

- [ ] Semantic HTML first; ARIA only for gaps; accessible name on every control; correct heading order.
- [ ] Keyboard: everything reachable, logical order, no traps, `focusRing` visible; dialogs trap and restore focus (`Overlay`/`Sheet` do it).
- [ ] Contrast ≥ 4.5:1 text, ≥ 3:1 UI/borders/icons, in light **and** dark mode. State never by color alone.
- [ ] Touch targets ≥ 44×44 px on mobile: `min-h-11 min-w-11`.
- [ ] Async content: skeleton (`Skeleton`, `motion-safe:animate-pulse`), never a spinner or blank. Skeleton/empty/error/populated share sizing → zero layout shift.
- [ ] Error states distinguish user-facing message from internals; retry is a real button. Async updates announced with `aria-live="polite"` where the user needs to know.
- [ ] Dark mode on every element, including skeletons, via `dark:` + tokens.
- [ ] Desktop and mobile layouts both purpose-built; no horizontal scroll of primary content on mobile.
- [ ] Motion only from tokens/primitives, interruptible, and `prefers-reduced-motion` collapses it (opacity-only or none).
- [ ] No duplicated utility patterns; no new dependency for what CSS/HTML does natively (`<details>`, `<dialog>`, `:active`, `<input type=…>`).

E2E specs (`e2e/tests/*-responsive.spec.ts`, `reduced-motion`, `dark-mode-contrast`, `overlay-focus-management`, `press-feedback`) cover these gates cross-browser — extend the matching one when a screen changes.
