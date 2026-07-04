# Phase 0 Research: App Navigation — Hamburger Menu, Dashboard & Back Navigation

All Technical Context fields were resolvable from the existing codebase and
the spec's own resolved assumptions. No `NEEDS CLARIFICATION` markers remain.
This document records the concrete decisions.

## 1. Route restructuring

- **Decision**: Repurpose `/app` as the Dashboard (new sign-in destination).
  Move the library and its sub-routes under `/app/library`:
  `/app/library` (list), `/app/library/add` (add record),
  `/app/library/records/:entryId` (record detail). Add `/app/wishlist` and
  `/app/profile` as new placeholder routes.
- **Rationale**: `/app` reads naturally as "the app's home," which is exactly
  what the Dashboard now is; nesting the library's sub-routes underneath
  `/app/library` correctly reflects that "add" and "record detail" are
  sub-flows of the library, not siblings of the Dashboard. This was flagged
  in the spec as a planning-phase detail precisely because it's a routing
  choice, not a user-facing requirement.
- **Alternatives considered**: Adding Dashboard at a new path (e.g.
  `/app/dashboard`) while leaving `/app` meaning "library" unchanged
  (rejected — leaves `/app`'s meaning inconsistent with it now being reached
  by a menu item rather than being the default landing spot, and doesn't
  match the request that the logo/app name — which conventionally points to
  "home" — leads to the Dashboard); flattening everything under `/app/*`
  without nesting add/record-detail under `/app/library` (rejected — less
  clear information architecture for no benefit).

## 2. Hamburger menu implementation

- **Decision**: Extend the existing `Modal` component
  (`frontend/src/components/ui/Modal.tsx`) with an optional `position` prop
  (`'center' | 'end'`, defaulting to `'center'` so every existing caller —
  `ReleasePreviewModal` — is unaffected). `position="end"` renders the panel
  as a full-height drawer anchored to the inline-end edge (right in LTR)
  instead of a centered card, reusing the same backdrop/`Escape`/close-button
  logic already implemented and tested. A new `HamburgerMenu` component uses
  `Modal position="end"` to render the three navigation links.
- **Rationale**: A slide-in drawer is the conventional pattern for this kind
  of menu on both mobile and desktop, and `Modal` already implements every
  piece of overlay behavior (backdrop click, `Escape`, focus-visible close
  button, `role="dialog"`/`aria-modal`) needed — extending it in a
  backward-compatible way (an additive, defaulted prop) avoids duplicating
  that logic in a second overlay component, directly matching how `Button`
  was earlier extended with a `size` prop in feature 006 rather than
  duplicating its styling.
- **Alternatives considered**: A brand-new `Drawer` component separate from
  `Modal` (rejected — would duplicate backdrop/`Escape`/focus-close logic
  that already exists, working, and tested); a third-party
  headless-menu/drawer library (rejected — no simpler than extending the
  existing hand-built primitive, and this app has consistently avoided
  adding UI libraries per Principle III).

## 3. Menu trigger placement in the header

- **Decision**: Add a hamburger icon button to `AppHeader`, alongside the
  existing logo (left) and sign-out button (right) — the hamburger trigger
  sits on the right side, near (but visually distinct from) the sign-out
  button. The existing sign-out button is left exactly where it is today;
  it is not folded into the new menu, since the spec only asked for three
  menu options and moving sign-out was not requested.
- **Rationale**: Keeps the change minimal and scoped to what was asked
  (Principle III) — the header already has a working left/right layout
  (`justify-between`), so adding one more control to the right side requires
  no structural rework.
- **Alternatives considered**: Moving "Sign out" inside the new menu
  (rejected — not requested, and removing a visible, working control as a
  side effect of an unrelated feature risks surprising users); placing the
  hamburger trigger on the left, next to the logo (rejected — the logo
  itself is already a distinct, meaningful click target for "go to
  Dashboard," and placing an unrelated trigger immediately next to it risks
  mis-clicks).

## 4. Back-action placement and behavior

- **Decision**: A new `BackLink` atomic component (`components/ui/BackLink.tsx`)
  renders a left-chevron icon plus a "Back" label, as a plain `Link` to a
  caller-supplied `to` path — not a `history.back()`/`navigate(-1)` call.
  It is placed at the top of the page's content area (above the page's
  heading), not inside the shared global header. Only `AddRecordPage` and
  `RecordDetailPage` render one, linking back to `/app/library` — per the
  spec's resolved assumption, the four top-level destinations (Dashboard,
  library, wishlist, profile) don't need one, since they're already one menu
  selection apart from each other.
- **Rationale**: A fixed `Link` to the known parent (`/app/library`) is
  simpler and fully deterministic (Principle III) — both screens that need a
  back action are, in this app, only ever reached from the library, so a
  fixed destination satisfies "returns to where they came from" without the
  edge cases of `navigate(-1)` (e.g. a collector who deep-links directly to
  a record's detail page would have no useful browser-history entry to go
  back to). Placing it at the top of the content area (rather than inside
  the shared header) keeps the header's job limited to app-wide navigation
  (logo, menu, sign-out) and the back action scoped to the specific screen
  it belongs to, matching where collectors expect a "back" affordance
  relative to a screen's own title/content (adjacent to what it's backing
  out of, not mixed into global chrome).
- **Alternatives considered**: `navigate(-1)` via browser history (rejected —
  non-deterministic if a collector arrived via a direct link or a refresh,
  which existing feature 004 work already had to account for when adding SPA
  fallback routing); placing the back action inside `AppHeader` itself
  (rejected — would require the header to know per-route context it
  otherwise doesn't need, entangling a page-specific concern into shared
  chrome).

## 5. Placeholder pages

- **Decision**: A single shared `UnderConstruction` presentational component
  (title + a short explanatory message, inside the existing `Card`) is
  reused by `DashboardPage`, `WishlistPage`, and `ProfilePage`, each of which
  is otherwise just a thin page wrapper passing its own heading text.
- **Rationale**: The spec explicitly says building these sections is out of
  scope; a single reusable "under construction" pattern avoids three
  near-identical bespoke pages (Principle III) and keeps them visually
  consistent with each other and with the rest of the app's `Card`-based
  design system.
- **Alternatives considered**: Three fully independent page components with
  their own inline "under construction" markup (rejected — duplicates the
  same visual pattern three times, which the constitution explicitly calls
  out as something to extract instead).

## 6. Existing test updates required

- **Decision**: `signInFlow.test.tsx` and `signOutFlow.test.tsx` currently
  assert `getByText(/your library/i)` as proof that sign-in succeeded; both
  are updated to assert the Dashboard's placeholder content instead, since
  that is now the correct post-sign-in destination.
  `recordDetailFlow.test.tsx` and `addRecordFlow.test.tsx` currently mount
  their pages at `/app/records/:entryId` and `/app/add` respectively (with a
  `/app` stub route standing in for the library); both are updated to the
  new nested paths (`/app/library/records/:entryId`,
  `/app/library/add`), with their stub "previous screen" route updated to
  `/app/library`.
- **Rationale**: These tests encode today's routes/destinations directly;
  since this feature intentionally changes both, the tests must change with
  them to keep validating real behavior rather than stale assumptions.
- **Alternatives considered**: Leaving the old routes in place as redirects
  alongside the new ones (rejected — not requested, adds permanent
  complexity for a personal-project-scale app with no external bookmarks to
  preserve).

## Outcome

All unknowns are resolved. No `NEEDS CLARIFICATION` markers remain. Proceeding
to Phase 1 design (data-model.md, contracts/, quickstart.md).
