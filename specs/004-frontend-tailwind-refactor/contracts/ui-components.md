# UI Component Contracts: `frontend/src/components/ui/`

This feature has no network/API surface (see spec Assumptions — no backend changes).
Its "contracts" are the public prop interfaces of the shared atomic components,
which every page/screen consumes. These are the boundaries Phase 2 tasks must
implement against, and what unit tests in `frontend/tests/unit/` must verify.

## `Card`

```ts
interface CardProps {
  children: React.ReactNode;
  className?: string;
  padding?: 'sm' | 'md'; // maps to p-4 / p-6; default 'md'
}
```

**Contract**:
- Renders a single container element with `rounded-xl border shadow-sm` (or
  `shadow-md` where a screen needs slightly more elevation) plus the padding
  matching `padding`.
- MUST render identically (same classes) regardless of which screen uses it —
  screen-specific spacing is applied by the caller via layout (`gap-*`,
  `space-y-*`) around the `Card`, never by forking `Card`'s own classes.
- MUST support `dark:` rendering with no additional prop — theming is derived from
  `@theme` tokens, not passed in.

## `Button`

```ts
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary'; // default 'primary'
  loading?: boolean; // shows a busy state; sets aria-busy
}
```

**Contract**:
- `primary` uses the accent (`--color-primary`)-backed background; `secondary` uses
  a neutral/bordered treatment.
- `loading` MUST disable the button and set `aria-busy="true"`, preserving the
  button's footprint (no size change) so no layout shift occurs when toggling
  loading.
- Existing call sites (`GoogleSignInButton`, sign-out, search/add/edit/save/remove
  actions) MUST continue to expose the same `onClick`/`disabled` semantics they use
  today — this refactor changes styling and composition, not event contracts.

## `Badge`

```ts
interface BadgeProps {
  children: React.ReactNode;
  tone?: 'neutral' | 'muted'; // default 'neutral'
}
```

**Contract**:
- Small inline label, restrained color palette (no more than the two documented
  tones for this feature).

## `Avatar`

```ts
interface AvatarProps {
  src?: string;
  alt: string;
  size?: 'sm' | 'md' | 'lg'; // default 'md'
}
```

**Contract**:
- Fixed, size-driven `width`/`height` (`w-* h-*`) regardless of whether `src` is
  present — when `src` is absent, renders a neutral placeholder at the same
  dimensions, so swapping between "no cover yet" and "cover loaded" never shifts
  layout.

## `Input`

```ts
interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  id: string;
}
```

**Contract**:
- Renders a `<label htmlFor={id}>` paired with the control, preserving existing
  accessibility semantics used today (`RecordDetailPage`'s condition/notes fields,
  `AddRecordPage`'s search field).
- Visual-only refactor: existing `value`/`onChange` wiring at call sites is
  unchanged.

## `Skeleton`

```ts
interface SkeletonProps {
  className?: string; // caller supplies w-*/h-* to match the real content's size
  rounded?: 'md' | 'full'; // default 'md'
}
```

**Contract**:
- Renders `bg-gray-200 dark:bg-gray-800 animate-pulse` plus the requested
  `rounded-*` and whatever sizing classes the caller passes via `className`.
- MUST NOT define its own width/height defaults that could mismatch real content —
  sizing is always caller-supplied so it can be kept identical to the
  corresponding loaded-state element (data-model.md §3).

## Screen-level contract (applies to `LibraryListPage`, `RecordDetailPage`, `AddRecordPage` search results)

Each screen's async content area MUST expose (internally, not as a public API) one
of exactly four render branches — `loading | empty | error | loaded` — as defined in
`data-model.md` §3, each built from the same `Card`/`Skeleton` sizing so the branch
switch never changes the element's footprint. This is verified by:
- Unit tests per new `ui/` component (renders expected classes/structure/props).
- Existing integration tests for `LibraryListPage`, `RecordDetailPage`, and
  `AddRecordPage` continuing to pass unmodified in their user-facing assertions
  (FR-008), with only the one known class-name-coupled assertion in
  `landingLayout.test.tsx` updated (see research.md §5).
