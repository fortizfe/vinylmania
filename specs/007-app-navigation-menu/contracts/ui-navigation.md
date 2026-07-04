# UI Contracts: Navigation Components

This feature has no network/API surface (no backend change — see plan.md).
Its "contracts" are the navigation component interfaces below, which
Phase 2 tasks must implement against and quickstart.md verifies.

## `Modal` (changed)

```ts
interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  position?: 'center' | 'end'; // NEW, default 'center'
}
```

**Contract**:
- `position="center"` MUST render exactly as it does today (existing
  `ReleasePreviewModal` behavior/tests are unaffected).
- `position="end"` MUST render the content panel as a full-height panel
  anchored to the inline-end edge of the viewport, still behind the same
  backdrop, still closable via backdrop click, the visible close control,
  and `Escape`.
- Both positions keep `role="dialog"` / `aria-modal="true"` on the panel.

## `HamburgerMenu` (new)

```ts
// No props — self-contained.
function HamburgerMenu(): JSX.Element;
```

**Contract**:
- Renders a single trigger control (the hamburger icon button) plus a
  `Modal` (`position="end"`) containing exactly three links, in this order:
  "My library" → `/app/library`, "My wishlist" → `/app/wishlist`,
  "Profile" → `/app/profile`.
- The menu starts closed; activating the trigger opens it; selecting any
  link, clicking the backdrop, pressing `Escape`, or activating the close
  control all close it.
- Opening the menu MUST NOT itself navigate anywhere (FR-012) — only
  selecting a link does.
- This component is only ever rendered inside `AppHeader`, which is only
  ever rendered inside `AuthenticatedLayout` — it MUST NOT be rendered on
  `LandingPage` (FR-008), and this feature introduces no prop or code path
  that would allow it to be.

## `BackLink` (new)

```ts
interface BackLinkProps {
  to: string;
  label?: string; // default: "Back"
}
```

**Contract**:
- Renders a single link combining a left-chevron icon and the label,
  navigating to `to` when activated.
- Identical markup/classes regardless of caller — no per-page styling
  variants — so it looks and behaves the same everywhere it's used
  (FR-011).

## `UnderConstruction` (new)

```ts
interface UnderConstructionProps {
  title: string;
}
```

**Contract**:
- Renders a `Card` containing the given `title` and a short, static message
  communicating the section isn't built yet. No async state, no loading
  variant — this is always-static content.

## Route contract

| Path | Rendered page | Notes |
|---|---|---|
| `/app` | `DashboardPage` | Reached by sign-in and by clicking the logo; NOT listed in `HamburgerMenu` (FR-004) |
| `/app/library` | `LibraryListPage` | Reached via `HamburgerMenu`'s "My library" |
| `/app/library/add` | `AddRecordPage` | Reached from `LibraryListPage`; renders a `BackLink` to `/app/library` |
| `/app/library/records/:entryId` | `RecordDetailPage` | Reached from `LibraryListPage`/`RecordCard`; renders a `BackLink` to `/app/library` |
| `/app/wishlist` | `WishlistPage` | Reached via `HamburgerMenu`'s "My wishlist"; `UnderConstruction` |
| `/app/profile` | `ProfilePage` | Reached via `HamburgerMenu`'s "Profile"; `UnderConstruction` |
