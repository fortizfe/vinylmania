# Phase 1 Data Model: App Navigation — Hamburger Menu, Dashboard & Back Navigation

This feature introduces no domain data, storage, or API changes. Its "model"
is the route table and the navigation component contracts.

## 1. Route Table (CHANGED)

| Path | Page | Auth? | Change |
|---|---|---|---|
| `/` | `LandingPage` | No | Unchanged |
| `/app` | `DashboardPage` | Yes | **Changed** — was `LibraryListPage` |
| `/app/library` | `LibraryListPage` | Yes | **New path** — same page, moved |
| `/app/library/add` | `AddRecordPage` | Yes | **New path** — was `/app/add` |
| `/app/library/records/:entryId` | `RecordDetailPage` | Yes | **New path** — was `/app/records/:entryId` |
| `/app/wishlist` | `WishlistPage` | Yes | **New** |
| `/app/profile` | `ProfilePage` | Yes | **New** |

All authenticated routes continue to be wrapped by the existing
`AuthenticatedLayout` (which renders `AppHeader` and redirects unauthenticated
visitors to `/`), unchanged.

## 2. Link/Navigation Call Sites (CHANGED)

| File | Current | New |
|---|---|---|
| `components/AppHeader.tsx` | `<Link to="/app">` (logo) | Unchanged value (`/app`) — now correctly points at the Dashboard because of the route table change, no code edit needed beyond confirming intent |
| `pages/LandingPage.tsx` | `<Navigate to="/app" replace>` (already-authenticated visitor) | Unchanged value — now correctly lands on Dashboard |
| `components/RecordCard.tsx` | `<Link to={`/app/records/${entry.id}`}>` | `<Link to={`/app/library/records/${entry.id}`}>` |
| `pages/LibraryListPage.tsx` | `<Link to="/app/add">` ("Add a record") | `<Link to="/app/library/add">` |
| `pages/RecordDetailPage.tsx` | `navigate('/app')` (after remove) | `navigate('/app/library')` |

## 3. Component Model

| Component | Represents | Key Props | Composed from |
|---|---|---|---|
| `Modal` (changed, `ui/`) | Generic overlay — now supports two layouts | `open`, `onClose`, `title?`, `children`, **`position?: 'center' \| 'end'`** (new, default `'center'`) | `Card` (content panel), unchanged backdrop/`Escape` logic |
| `HamburgerMenu` (new) | The nav trigger + drawer, rendered inside `AppHeader` | none (self-contained: owns its own open/closed state) | `Modal` (`position="end"`), `Link` |
| `BackLink` (new, `ui/`) | Consistent "go back" affordance | `to: string`, `label?: string` (default `"Back"`) | Plain `Link` + inline chevron SVG |
| `UnderConstruction` (new) | Shared placeholder content | `title: string` | `Card` |
| `DashboardPage` / `WishlistPage` / `ProfilePage` (new) | Thin page wrappers | none | `UnderConstruction` |

## 4. Navigation State Model

- The hamburger menu's open/closed state is local, ephemeral UI state owned
  by `HamburgerMenu` itself (no route or global state needed) — closing it
  (backdrop click, `Escape`, close button, or selecting a link) always
  returns to a closed state with no side effects beyond an optional
  navigation.
- `BackLink` carries no state — it is a pure link to a fixed path
  (`/app/library`, in both of its current call sites).

## 5. Relationships

- `HamburgerMenu` is rendered once, inside `AppHeader`, which is itself only
  rendered inside `AuthenticatedLayout` — this is the existing structural
  guarantee that satisfies FR-008 (menu never reachable on the landing page)
  without any new conditional logic.
- `BackLink` is rendered by `AddRecordPage` and `RecordDetailPage` only — the
  four top-level destinations (`DashboardPage`, `LibraryListPage`,
  `WishlistPage`, `ProfilePage`) do not render one, per the spec's resolved
  assumption.
