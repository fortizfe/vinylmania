# Contract: `useIndependentColumnLayout`

**Location**: `frontend/src/hooks/useIndependentColumnLayout.ts`

**Consumers**: `RecordDetailLayout.tsx`, `RecordDetailSkeleton.tsx` (both rendering the interleaved rail/content card sequence used by `ReleaseDetailPage`, `RecordDetailPage`, and their shared loading state).

## Purpose

Give two logical columns of cards ("rail" and "content"), interleaved in a fixed DOM order, independent visual stacking heights on desktop viewports — with zero shared-row gaps — **without moving, reordering, or duplicating any DOM node**. Below the `lg` breakpoint, it is a no-op and the existing single-column flow (`flex flex-col gap-4`) is unaffected.

## Input

```ts
type ColumnSlot = {
  /** Stable key, matching the card's existing data-testid or section name. */
  key: string;
  /** Ref to the card's rendered root element. Must be attached before layout runs. */
  ref: React.RefObject<HTMLElement>;
  /** Which visual column this card belongs to. Order across all slots must match DOM order. */
  column: 'rail' | 'content';
};

function useIndependentColumnLayout(slots: ColumnSlot[]): {
  /** Inline style to apply to each slot's wrapper, by `key`. Empty object below `lg`. */
  styleFor: (key: string) => React.CSSProperties;
  /** Inline style for the shared positioning container (sets computed height on `lg`+). */
  containerStyle: React.CSSProperties;
  /** True once the first measurement pass has completed on `lg`+, to gate an
   *  opacity-0 → opacity-100 reveal and avoid a flash of overlapping cards. */
  ready: boolean;
};
```

## Behavior guarantees

1. **DOM order is never read from `slots` order beyond initial measurement bookkeeping** — the hook never reorders, clones, or moves the elements `slots[i].ref` points to. It only returns CSS (`position`, `top`, `left`/`right`, `width`) to apply via the existing wrapper `<div>` for each slot.
2. **No shared row-height coupling**: a slot's `top` offset is a pure function of the cumulative measured height of the *preceding same-column* slots — a rail slot's position never depends on any content-column slot's height, and vice versa.
3. **Recompute triggers**: a `ResizeObserver` per slot (covers async image loads, expanding content, font-driven reflow) and a `matchMedia('(min-width: 1024px)')` change listener (covers viewport resize across the breakpoint). No polling, no scroll listeners.
4. **Below `lg`**: `styleFor` returns `{}` for every slot and `containerStyle` returns `{}` — the caller's existing mobile flex layout is completely unaffected.
5. **No CSS `order` property, no `transform`-based reordering that would desync visual and hit-test position from focus order** — only `position`/`top` are used, so hover, click, and focus all remain aligned with what's visually rendered.
6. **Idempotent across remount**: unmounting and remounting the consuming component (e.g. a route change) produces the same layout with no stale observers (all `ResizeObserver`/`matchMedia` subscriptions are cleaned up on unmount).

## Non-goals

- Does not decide *which* column a card belongs to — that mapping is supplied by the caller (`RecordDetailLayout`/`RecordDetailSkeleton`) exactly as today's `railSlot`/`columnSlot` constants do.
- Does not animate the transition between layout states (constitution/spec: no entrance animation on this page — a static, predictable layout is the point).
- Does not handle more than two columns — out of scope for this feature's three affected pages.

## Test expectations (Test-First, Principle I)

A failing test MUST exist before implementation for each of:
- Two slots in the same column stack with exactly the design system's card gap between them, regardless of the other column's slot heights.
- A slot's height increasing after mount (simulated via the `ResizeObserver` test stub, see `research.md` R4) shifts only the same-column slots below it.
- Below the `lg` breakpoint, `styleFor` and `containerStyle` return `{}` for all slots.
- Unmounting disconnects every `ResizeObserver` and removes the `matchMedia` listener (no leaks across route changes).
