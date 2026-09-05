# Contract: component API changes (all additive / backward-compatible)

Per Constitution VI, every change here is MINOR — no prop removed, none repurposed, no data schema touched. Existing call sites keep working unchanged; new behavior is opt-in or transparent.

---

## `ui/Modal.tsx`

**Change**: internals re-implemented on top of `motion/Overlay`. Public props unchanged (`open`, `onClose`, `title`, `children`, `position`, `size`, `hideScrollbar`).

| Aspect | Before | After |
|--------|--------|-------|
| Focus | not trapped; focus not restored | trapped while open; restored to opener on close |
| Background scroll | not locked | locked (scrollbar compensated) |
| Backdrop | flat `bg-black/50` | `bg-stone-950/60` + `backdrop-blur-md` (+ fallbacks) |
| Open/close | instant mount/unmount | `center`: spring scale+opacity+blur; `end`: spring slide on-axis; both interruptible; reduced-motion → opacity-only |
| `position="end"` | static drawer | drag-to-dismiss via `Sheet` (button + Escape still work) |
| `aria-labelledby` | title not linked | title gets an id, linked via `aria-labelledby` |

**New optional prop**: `restoreFocusRef?: RefObject<HTMLElement>` — override the focus-restore target.

**Existing tests**: all current `Modal.test.tsx` assertions remain valid (role, aria-modal, close button, Escape, backdrop click, size classes, end-drawer classes, 44×44 close button). New tests add focus-trap / restore / scroll-lock / reduced-motion.

---

## `components/GalleryFullscreenViewer.tsx`

**Change**: rendered through `motion/Overlay` (variant `center`, full-bleed). Adds:
- Horizontal **swipe** between images (`drag="x"`, offset/velocity thresholds from `tokens.dismiss`, `spring.momentum`) — thumbnails stay in sync.
- **Keyboard**: `ArrowLeft` / `ArrowRight` move between images (new); Escape + thumbnail buttons + close button unchanged (FR-013 parity).
- Focus trap + restore + scroll lock (via `Overlay`).
- Backdrop `bg-stone-950/90` kept (already near-opaque) + `backdrop-blur-sm`; reduced-transparency → no blur.

Props unchanged (`images`, `selectedIndex`, `onSelect`, `alt`, `onClose`).

---

## `ui/ThemeToggle.tsx`

**Change**: knob + sky/night crossfade move from CSS `transition-colors duration-300 ease-in-out` to `m` + `spring.default` for the knob translate, `motionDuration.fade` + `easing.out` for the sky/stars opacity. `role="switch"` / `aria-checked` / `aria-label` unchanged. Reduced-motion → knob position changes with no transition, opacity crossfade only. Shared `focusRing`.

No prop changes (`theme`, `onToggle`, `className`).

---

## `ui/ViewModeToggle.tsx`

**Change**: active-option background becomes a **shared-element sliding pill** (`m` + `layoutId` + `spring.default`) instead of the color snapping between buttons. `role="radiogroup"` / roving tabindex / arrow keys unchanged. Reduced-motion → pill jumps (no layout animation). Shared `focusRing`.

No prop changes (`mode`, `onChange`, `screen`).

---

## `filters/CollapsibleFilterPanel.tsx`

**Change**: expand/collapse animates height + opacity (`motionDuration.collapse`, `easing.out`, measured height — not `auto`) instead of instant show/hide; chevron rotates with the same token. Reduced-motion → instant. Behavior (starts collapsed, stays open until explicitly collapsed) unchanged.

No prop changes (`activeCount`, `children`).

---

## `ui/Button.tsx` (+ `buttonClassName` / `iconButtonClassName`)

**Change**: adds a **pressed state** — `active:scale-[0.97]` + subtle `active:brightness-95` (dark: `active:brightness-110`), `transition-[transform,filter] duration-[130ms] ease-out` (tokenized). Suppressed when `disabled || loading` and under `prefers-reduced-motion` (scale dropped, keep the brightness shift). Focus ring already matches the shared pattern — extracted to the shared `focusRing` constant. `hover:opacity-90` on primary kept.

No prop/signature changes. `baseClassName` gains the press utilities; `buttonClassName()` output changes (additive classes) — snapshot-style tests updated.

---

## Shared `focusRing`

**New**: a single exported constant (e.g. `frontend/src/components/ui/focusRing.ts`):

```ts
export const focusRing =
  'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2';
```

Applied by `Button`, `ThemeToggle`, `ViewModeToggle`, `StarRating`, `GalleryFullscreenViewer` thumbnails, `BackLink`, `InlineEditableField` trigger, filter chips, `Checkbox` — replacing the per-component copies and the historical `outline-primary` variants noted in the `Button` / `StarRating` source comments. No visual change (same utilities); this is a consistency + single-source-of-truth move (FR-014).

---

## `components/AppHeader.tsx` / `components/LandingHeader.tsx`

**Change**: the hard `border-b border-stone-200 dark:border-border-dark` becomes a **scroll-edge treatment** — border replaced by a subtle shadow/gradient mask that fades in only once page content scrolls under the sticky header (apple-design §12; research.md R5). Surface stays opaque near-black tokens (constitution rule wins over full translucency). Reduced-motion → the mask appears without a transition.

No prop changes. Layout/height classes unchanged (no layout shift).

---

## `ui/Skeleton.tsx` (+ all `*Skeleton.tsx`)

**Change**: `animate-pulse` wrapped so it is disabled under `prefers-reduced-motion` (a `motion-safe:animate-pulse` utility or a `@media` guard in `global.css`). Dimensions / structure unchanged (no-layout-shift rule already satisfied).

---

## Components with **no API change** (press-state / focusRing / token adoption only — `refine`)

`ui/Badge`, `ui/Avatar`, `ui/Input`, `ui/Checkbox`, `ui/BackLink`, `ui/StarRating`, `ui/ReleaseRatingBadge`, `ui/InlineEditableField`, `filters/SelectableListFilter`, `filters/FilterActions`, `FiltersControl`, `HamburgerMenu`, `HeaderNavIcons`, `HeaderSearchBox`, `RecordCard`, `RecordListRow`, `SearchResultCard`, `SearchResultListRow`, `ResultCardActions`, `FeedArticleCard`, `FeedArticleBoard`, `FeedCategoryFilterBar`, `FeedSourceFilterBar`, `FeedSourceStatusBanner`, `DiscogsConnectionCard`, `DiscogsRelinkNotice`, `LibraryLinkRequired`, `MasterReleaseDetailsSection`, `MasterReleaseOtherDetailsSection`, `MasterVersionsTable`, `MyCopySection`, `ReleaseDetailsSection`, `ReleaseAdditionalInfoSection`, `ReleaseTracklistSection`, `ReleaseImageGallery`, `LandingHero`, `LandingPillarSection`, `GoogleSignInButton`, `UnderConstruction`, `RecordDetailSkeleton`, and all `*Skeleton` components.

See [audit.md](../audit.md) for the per-component disposition and rationale.

## Components reviewed, **no change** (`conforms`)

`brand/VinylmaniaIcon`, `brand/VinylmaniaWordmark`, `brand/VinylmaniaGrungeFilter`, `ui/Card`, `ui/icons/CloseIcon` — see audit.md.
