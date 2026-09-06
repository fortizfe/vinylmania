# feat(059): Apple HIG component polish — motion, depth, gestures, consistency

Brings Vinylmania's entire shared component library up to the design principles of Apple's
Human Interface Guidelines (Constitution **Principle XI**), without regressing WCAG 2.1 AA
(**Principle X**) or the Tailwind design-system rules. Built with the installed
`apple-design`, `emil-design-eng`, and `animate` skills; every component's rationale is
recorded in [`specs/059-apple-hig-component-polish/audit.md`](audit.md).

Spec / plan / tasks: [`specs/059-apple-hig-component-polish/`](.) · 97 tasks, 5 user-story
increments on one branch.

## What changed

| Area | Before | After |
|------|--------|-------|
| **Press feedback** (US1) | feedback on release only; 3 different focus-ring idioms | every control depresses on **pointer-down** (`:active` scale + brightness, CSS-only), suppressed when disabled / `aria-busy` / `prefers-reduced-motion`; one shared `focusRing` on 100% of controls |
| **Motion** (US2) | linear `transition-*`, `duration-300 ease-in-out`, instant modal mount | spring/token motion for modal, toggles, disclosure, gallery — physically believable, **interruptible from the presentation value**, single shared token set; `prefers-reduced-motion` → opacity-only, skeletons don't pulse |
| **Overlay depth** (US3) | flat `bg-black/50`, **no focus trap, no focus restore, no scroll lock** | translucent dim+blur material with `@supports` / `prefers-reduced-transparency` / `prefers-contrast` fallbacks; focus trap + restore + body-scroll lock — the 4 latent `Modal` gaps closed, and extended to the fullscreen gallery |
| **Gestures** (US4) | drawer & gallery were button/keyboard only | 1:1 drag-to-dismiss sheets (45% distance **or** 500 px/s flick, rubber-band, spring-back) and horizontal gallery swipe with momentum projection — **every gesture keeps a visible button + keyboard equivalent** |
| **Consistency & type** (US5) | underline-as-emphasis, hard header borders, per-component focus strings | one documented pattern per concept ([`frontend/src/motion/README.md`](../../frontend/src/motion/README.md)); size-specific display tracking/leading (`-0.02em` / `1.05`); scroll-edge header shadow (opaque near-black surface kept); status-message entrance scoped to stateful banners only |

## New shared infrastructure

- **`frontend/src/motion/`** — the only module that imports `motion`. `tokens.ts` (springs / durations / easings / dismiss thresholds), `MotionProvider` (`LazyMotion` + `MotionConfig reducedMotion="user"`), `Overlay`, `Sheet`, `useFocusTrap` / `useScrollLock` / `useRestoreFocus` / `usePrefersReducedMotion`. A Vitest guard (`motion-import-boundary.test.ts`) fails any direct `motion` import outside this module.
- **`frontend/src/components/ui/press.ts`** (`pressable` / `pressableCard` / `pressableRow` / `pressableNudge`) and **`focusRing.ts`** — CSS-only, no library.
- Motion + typography tokens in `frontend/src/styles/global.css` (`--ease-*`, `--motion-duration-*`, `--tracking-display`, `--leading-display`) + `@media (prefers-reduced-motion | -transparency | -contrast)` blocks.

## Constitution deviations (per Development Workflow gate)

Tracked in [`plan.md` → Complexity Tracking](plan.md); reconciled in [`audit.md` → Deviations from plan](audit.md).

**Justified new complexity (3, from the plan):**
1. **`motion` dependency** (`motion@^12`, `domMax` feature set, lazy chunk **27.6 KB gzip**, out of the initial payload). HIG-grade motion needs interruptible velocity-aware springs + drag; hand-rolling that across ~15 components is more code and more risk than one wrapped library. `react-spring`+`@use-gesture` = two deps for the same thing.
2. **`frontend/src/motion/` module** — required by Principle IV (Dependency Inversion) + FR-006a so no component imports `motion` directly and the library stays swappable; also the single place reduced-motion handling can't be forgotten.
3. **CSS motion custom properties + `@media` preference blocks in `global.css`** — tokens must be shared between CSS-only transitions and the JS spring layer; `@media` preference queries have no Tailwind-utility equivalent; `tailwind.config.js` is disallowed by the CSS-first rule.

**In-flight, accepted (documented in `audit.md`):**
4. `ViewModeToggle` sliding pill shipped as a **measured-transform `m.div`**, not `layoutId` — same visual result and interruptibility, no `layout` projection jitter; kept even after (5) made `layoutId` available.
5. `MotionProvider` uses **`domMax`** not `domAnimation` — `drag` (FR-010/FR-012) needs it.
6. `usePrefersReducedMotion` added as a 7th `motion/` primitive — components that branch their own `transition` prop need the boolean at render time.
7. `Overlay` gained additive optional props (`ariaLabel`, `surfaceTestId`, `exitTransition`, `surfaceDrag`, `scrim`, …) — all backward-compatible, **Principle VI stays MINOR** (no prop removed or repurposed, no data schema touched).

## Known / accepted limitations

- **`useEscapeKey` is not stack-aware** — with a nested confirm-in-modal stack open (only the DEV-only `NestedOverlayHarness` fixture uses this today), one Escape collapses both layers. No nested-overlay product pattern exists; revisit if one is added.
- **FR-011 "scroll-first" branch** is only reachable for a **y-axis sheet**, which the product doesn't have. The one real `Sheet` is the x-axis hamburger drawer; `scrollBlocksDismiss` covers it and the y-axis case stays covered by `Sheet.test.tsx` unit tests, activating automatically when a y-axis sheet is added.
- **Motion perf — overlay mount spike** (`audit.md` Deviation #8): under 4× CPU throttle, the steady-state animation holds a 60 fps median, but the React overlay-mount commit + first `backdrop-filter` scrim composite spikes **1–3 frames at 50–70 ms** (gallery ~100 ms, image-decode-dominated). One-time, never blocks input (< 150 ms). **Suggested follow-up:** profile / lighten the animated Modal-scrim blur ramp.
- **Gallery follow-up:** `GalleryFullscreenViewer` now passes `ariaLabel` to its dialog (fixed in US4); if `audit.md` still lists this as open, it's stale.

## Process notes

- **Test-First**: unit tests were RED-first throughout; the US1 **e2e** spec (`press-feedback.spec.ts`) landed just after its implementation rather than before it — behaviour is correct and now covered.
- **Pre-existing, untouched:** ~45 files fail `prettier --check` on `main` (unrelated to this feature) — candidate for a separate `style:` sweep. This PR's own files are clean (`cc36a28`).
- **Pre-existing e2e infra gap:** the `e2e/` suite needs Redis on `:6379` (`backend/.env` `REDIS_URL`, not neutralised by the Playwright `webServer`), and nothing flushes it between runs — a warm `discogs:release:*` cache can make `discogs-catalog-relink.spec.ts` fail on repeated **local** runs (CI with fresh Redis is fine). Worth a `beforeEach` cache-reset or an isolated e2e Redis DB — for the spec-053 / e2e owner.

## Verification

- **Frontend:** `npm run test` → **640/640** · `npm run lint` → clean (10 pre-existing fast-refresh warnings) · `npm run build` → green.
- **e2e:** full suite **322 passed / 0 failed / 2 skipped** (the 2 skipped are pre-existing `test.fixme` in `search-result-filters.spec.ts`, spec-042).
- **Accessibility (SC-005):** axe serious/critical = 0 on every scanned screen, both themes; `dark-mode-contrast` + `overlay-contrast` + `overlay-focus-management` all green; the 4 latent `Modal` gaps proven closed for all 3 overlays.
- **Success criteria:** SC-001…SC-008 **PASS**; SC-010 **PASS** for the animation window (mount spike documented above); **SC-009** (≥ 8/10 side-by-side "more responsive/polished") and the **SC-010 real-device confirmation** are deferred to human verification — see the "Manual verification" checklist below (tasks T094/T095).

## Manual verification still needed (T094 / T095)

**Real mid-tier phone** (research.md "Open feel-checks"):
1. Modal enter reads as blur+scale *materialize*, not a hard fade (check at 3× speed too).
2. Drawer drag-release bounce (`spring.momentum`, bounce 0.2) reads as "thrown", not "wobbly".
3. `ViewModeToggle` pill slides with no text-reflow jitter.
4. A hard gallery flick advances exactly one image (no 2-image overshoot).
5. Header scroll-edge shadow appears only after scrolling and doesn't shimmer.
6. The four throttled transitions show no visible stutter on a real device (4× CPU throttle is only a model).

**Side-by-side survey (SC-009):** pre-/post-059 build, ≥ 10 people, "which feels more responsive and more polished" — need ≥ 8/10.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
