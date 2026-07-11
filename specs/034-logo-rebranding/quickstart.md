# Quickstart: Adopt New Vinylmania Logo Branding

Validates that the new brand mark (icon + wordmark, per `docs/Vinylmania design
brief/Vinylmania Logo - Final.dc.html`) replaces the plain-text "Vinylmania"
label across the app header, landing header, landing hero, and favicon — in
both light and dark theme.

## Prerequisites

- Frontend dev server running (`cd frontend && npm run dev`); no backend/
  emulator dependency for this feature (purely frontend, no data).
- A browser able to toggle dark/light (OS setting or the app's own theme
  toggle on the Profile page) and resize to mobile/desktop widths.

## Steps

1. **Sign out / visit the landing page** (`/`). Confirm:
   - The sticky landing header shows the icon+wordmark lockup instead of
     plain text "Vinylmania" (FR-002).
   - The hero section shows the larger icon-above-wordmark "general logo"
     arrangement, with the wordmark's distressed/grunge effect visible
     (FR-002, FR-012, Clarifications).
   - Toggle OS dark/light (or reload with each `prefers-color-scheme`):
     the icon's colors switch between the light-context and dark-context
     variants with no flash of the wrong variant (FR-003, SC-002).

2. **Sign in and view any app page** (`/app`, `/app/search`, `/app/library`,
   `/app/profile`). At a desktop-width window, confirm:
   - The header shows the icon+wordmark lockup at a fixed size (36px icon /
     20px wordmark) — resize the window very wide and confirm it does NOT
     grow (FR-011).
   - The wordmark here is clean (non-grunge) typography, unlike the hero
     (FR-012).
   - Clicking the brand mark navigates to `/app`, same as today (FR-005).

3. **Resize to a mobile width** (or use devtools device toolbar, down to
   320px). Confirm:
   - The header shows the icon alone, no wordmark (FR-001, User Story 1 AC2).
   - It doesn't crowd or overlap the hamburger menu (FR-008).
   - The brand mark link still has an accessible name "Vinylmania" (inspect
     via browser devtools accessibility tree, or screen reader) even with no
     visible text (research.md §5).

4. **Check the browser tab favicon** on any page — confirm it shows the new
   circular "VM" icon, not the old abstract mark (FR-004, User Story 3).

5. **Run the automated checks**:
   ```bash
   cd frontend && npm test -- brand AppHeader LandingHeader LandingHero
   cd e2e && npx firebase --config ../backend/firebase.json emulators:exec \
     --only auth,firestore --project vinylmania-test \
     "npx playwright test dark-mode-contrast.spec.ts header-responsive-nav.spec.ts sign-in.spec.ts"
   ```

## Expected outcome

All steps above pass: the new brand mark appears everywhere the plain-text
label did, correctly themed, with no layout shift from the new font, no
regression to existing header navigation/sign-in behavior, and the checklist
in [checklists/requirements.md](./checklists/requirements.md) remains fully
checked.
