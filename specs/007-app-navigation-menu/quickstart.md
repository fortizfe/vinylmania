# Quickstart: Validating App Navigation

This guide validates the feature once implemented, per [spec.md](./spec.md),
[data-model.md](./data-model.md), and
[contracts/ui-navigation.md](./contracts/ui-navigation.md).

## Prerequisites

- Both apps running locally (`cd backend && npm run dev`,
  `cd frontend && npm run dev`) — see root `README.md`
- A signed-in test user (see `specs/001-landing-google-login/quickstart.md`)

## Automated validation

```bash
cd frontend && npm test   # unit tests for HamburgerMenu/BackLink, updated
                          # integration tests for sign-in/out, record-detail,
                          # add-record, and the new navigationMenu test
```

**Expected outcome**: All suites pass, including the four updated integration
tests and the new navigation-focused ones.

## Manual validation scenarios

### 1. Dashboard as the new entry point (User Story 1 / SC-001)

1. Sign out if currently signed in, then sign in again.
2. Confirm you land on a screen showing an "under construction" Dashboard —
   not the library.
3. Navigate to "My library" (via the menu), then click the logo/app name in
   the header.
4. Confirm you're back on the Dashboard.

### 2. Hamburger menu navigation (User Story 2 / SC-002, SC-003)

1. From the Dashboard, open the header's hamburger menu.
2. Confirm exactly three options appear: "My library", "My wishlist",
   "Profile".
3. Select "My library" — confirm you land on your existing library screen,
   working exactly as before.
4. Reopen the menu, select "My wishlist" — confirm an "under construction"
   placeholder appears.
5. Repeat for "Profile".
6. Resize the browser to a narrow (mobile) width and repeat steps 1–5 —
   confirm every option remains reachable and tappable.

### 3. Menu absence on the landing page (SC-004)

1. Sign out completely, returning to the landing page.
2. Confirm there is no hamburger icon, trigger, or any way to open a menu
   anywhere on the landing page, at both narrow and wide viewport widths.

### 4. Back navigation (User Story 3 / SC-005)

1. From the library, open a record's detail page. Confirm a back action is
   visible near the top of the content and returns you to the library when
   activated.
2. From the library, click "Add a record." Confirm the same back action
   appears in the same position/style and returns you to the library.
3. Confirm the Dashboard, library, wishlist, and profile screens themselves
   do not show this back action (they're reached directly via the menu/logo
   instead).

## Rollback

This feature's changes are route/link updates plus new/extended frontend
components — no backend or data changes. Reverting the corresponding commits
restores today's routes (`/app` = library, `/app/add`, `/app/records/:id`)
and removes the menu/back-link/placeholder pages with no other impact.
