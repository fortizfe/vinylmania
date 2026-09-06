# Quickstart: validating Apple HIG Component Polish

Frontend-only feature. All commands run from repo root unless noted.

## Prerequisites

```bash
cd frontend && npm install          # picks up the new `motion` dependency
cd ../e2e && npm install
```

- Node per repo `.nvmrc` / CI; Firebase emulator only needed for full e2e auth flows (see `e2e/README.md`).
- Two browser profiles for manual checks: default, and one with **Reduce Motion** enabled at the OS level.

## Build & unit tests

```bash
cd frontend
npm run test          # Vitest — motion/ hooks, tokens parity, component press/motion/reduced-motion specs
npm run lint          # oxlint — no direct `motion` import outside src/motion/
npm run build         # tsc -b && vite build — bundle must build; check `motion` is tree-shaken (LazyMotion)
```

**Expected**: all suites green; a token-parity test asserts `tokens.ts` matches the `--motion-*`/`--ease-*` custom properties in `global.css`; a lint/test guard fails if any file under `src/components/` imports `motion` directly.

## End-to-end / accessibility (the gate — FR-018 / SC-005)

```bash
cd e2e
npx playwright test dark-mode-contrast.spec.ts           # spec-058 contrast baseline — must stay green
npx playwright test --grep @a11y                          # axe scans on both themes
npx playwright test reduced-motion.spec.ts overlay-focus-management.spec.ts \
                    sheet-drag-dismiss.spec.ts gallery-swipe.spec.ts press-feedback.spec.ts
npx playwright test                                       # full suite before merge
```

**Expected**: zero axe `serious`/`critical` violations; contrast suite unchanged or better; new specs green.

---

## Per-story validation

### Foundational
- `npm run test` (frontend) passes for `src/motion/**`.
- App boots with `<MotionProvider>` mounted; no console errors; `document.body` scroll behaves normally (no lock leak).

### US1 — Instant press feedback (P1)
- **Automated**: `press-feedback.spec.ts` — `page.mouse.down()` on a `Button`, a filter chip, a star, a nav icon, an inline-edit trigger; assert the pressed transform/class is present *before* `mouse.up()`; assert a `disabled` button shows none.
- **Manual**: on a phone, every control visibly depresses the instant the finger lands; dragging off before release cancels it; keyboard `Enter`/`Space` still gives an acknowledgement and the focus ring is visible on both themes.
- **Reduced motion**: press still gives a brightness/opacity shift, no scale.

### US2 — Physical, interruptible transitions (P1)
- **Automated**: `overlay-focus-management.spec.ts` + `view-mode-toggle.spec.ts` + `library-filters.spec.ts` — open modal then trigger close mid-enter; sample `getBoundingClientRect()` across rAF ticks and assert no single-frame jump to start/end transform; assert one shared motion token drives all (no inline `cubic-bezier`/`duration-[` in components — a grep test).
- **Manual (feel-checks, research.md)**: modal "materializes" (blur+scale) rather than hard-fades; drawer enters and exits on the same edge; `ViewModeToggle` pill slides without text jitter; grab the drawer mid-animation and it follows the finger.
- **Reduced motion**: `reduced-motion.spec.ts` — `emulateMedia({ reducedMotion: 'reduce' })`; every animated element's `transform` is `none` mid-transition; skeletons have `animation-name: none`.

### US3 — Overlay depth & focus management (P2)
- **Automated**: `overlay-focus-management.spec.ts` — Tab/Shift+Tab stays inside modal, drawer, gallery; Escape / backdrop / close button each restore focus to the opener; background does not scroll while open; nested overlay unwinds focus correctly; `contrast.ts` over-blur assertion passes with busy cover art behind.
- **Manual**: backdrop dims + blurs the page; overlay reads as floating; with OS **Reduce Transparency** the scrim goes solid, no blur; with a browser lacking `backdrop-filter` the scrim is a stronger solid dim.

### US4 — Touch gestures (P2)
- **Automated**: `sheet-drag-dismiss.spec.ts` — synthetic pointer drag on the drawer: 1:1 tracking from grab point; release < 45% and slow → springs back open; release > 45% or fast flick → closes and fires `onClose`; drag starting mid-scroll (not at top) scrolls instead of dismissing. `gallery-swipe.spec.ts` — horizontal swipe advances the image, thumbnail `aria-current` follows, `ArrowLeft/Right` and thumbnail buttons still work.
- **Manual (real device)**: drawer rubber-bands at the closed edge; a hard flick doesn't skip two gallery images (momentum projection); every gesture has a visible button + key that does the same thing.

### US5 — Consistent interaction & typography (P2)
- **Automated**: a Vitest test asserts `focusRing` is the only focus utility string in `src/components/**` (grep); `theme-preference` / `view-mode-toggle` specs assert the shared focus treatment; display headings carry the tracking/leading tokens.
- **Manual**: every toggle/disclosure/dismissal of the same kind looks and behaves the same across screens; large headings have tightened tracking; no underline used purely for emphasis; sticky header shows a soft scroll-edge shadow instead of a hard line, only after scrolling.

---

## Definition of done (maps to Success Criteria)

| Check | SC |
|---|---|
| `press-feedback.spec.ts` green for every representative control | SC-001 |
| Every Scope component has an `audit.md` row; every task cites one | SC-002 |
| Interrupt tests show no transform jump on modal / drawer / gallery | SC-003 |
| `reduced-motion.spec.ts` green (no transform/scale, no skeleton pulse) | SC-004 |
| axe + `contrast.ts` suites ≥ baseline on both themes; Modal focus/scroll gaps closed | SC-005 |
| Grep test: no per-component motion durations/curves | SC-006 |
| Each shared concept → one documented pattern; instances conform | SC-007 |
| Gesture + button + keyboard covered for every gesture flow | SC-008 |
| Side-by-side: ≥ 8/10 rate the refreshed build more responsive/polished | SC-009 |
| CDP CPU-throttled frame-interval test ≤ ~20 ms p95 or documented fallback | SC-010 |
