import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type RefObject,
} from 'react';

/**
 * Gives two logical columns of interleaved cards ("rail" and "content")
 * independent visual stacking on desktop viewports, with zero shared-row
 * gaps — without moving, reordering, or duplicating any DOM node.
 *
 * See specs/065-fix-detail-column-gaps/contracts/useIndependentColumnLayout.contract.md
 * for the full contract this implements (feature 065, US1, T005).
 *
 * Root cause this replaces (research.md R1): CSS Grid's implicit row
 * auto-placement shares a row's height between whichever "rail" and
 * "content" cards happen to land in it, so a short card next to a tall one
 * leaves a gap-shaped hole. This hook instead measures each card's own
 * height (synchronously before first paint, then via one `ResizeObserver`
 * per card for later changes) and positions it with
 * `position: absolute` / `top`, offset only by the cumulative height of the
 * *same-column* cards that precede it — the two columns can never leak a
 * gap into each other because their running totals are entirely separate.
 */

/** Which visual column a slot belongs to. */
export type ColumnSlotColumn = 'rail' | 'content';

export interface ColumnSlot {
  /** Stable key, matching the card's existing data-testid or section name. */
  key: string;
  /** Ref to the card's rendered root element. Must be attached before layout runs. */
  ref: RefObject<HTMLElement | null>;
  /** Which visual column this card belongs to. Order across all slots must match DOM order. */
  column: ColumnSlotColumn;
}

export interface UseIndependentColumnLayoutResult {
  /** Inline style to apply to each slot's wrapper, by `key`. Empty object below `lg`. */
  styleFor: (key: string) => CSSProperties;
  /** Inline style for the shared positioning container (sets computed height on `lg`+). */
  containerStyle: CSSProperties;
  /**
   * True once the first measurement pass has completed on `lg`+. Exposed for
   * a future opacity-reveal gate — unused today, since a static, predictable
   * layout with no entrance transition is the deliberate design (research.md
   * R3 non-goals).
   */
  ready: boolean;
}

/** Tailwind's `lg` breakpoint — the point at which the two-column layout activates. */
const BREAKPOINT_QUERY = '(min-width: 1024px)';

/** Matches the desktop row gap (`lg:gap-y-6` = 1.5rem = 24px) this hook replaces. */
const CARD_GAP_PX = 24;

/** Matches the rail column track this hook replaces (`minmax(0, 20rem)`). */
const RAIL_WIDTH = '20rem';

/** Matches the column gap (`lg:gap-x-6` = 1.5rem) between the rail and content columns. */
const COLUMN_GAP = '1.5rem';

function isBreakpointActive(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false;
  }
  return window.matchMedia(BREAKPOINT_QUERY).matches;
}

export function useIndependentColumnLayout(
  slots: ColumnSlot[],
): UseIndependentColumnLayoutResult {
  const [active, setActive] = useState(isBreakpointActive);
  const [heights, setHeights] = useState<Record<string, number>>({});
  const [ready, setReady] = useState(false);

  // Always-fresh reference to the latest slots, read from inside the
  // ResizeObserver effect so it doesn't need to re-subscribe just because
  // the caller passed a new array literal on every render.
  const slotsRef = useRef(slots);
  slotsRef.current = slots;

  // A stable string derived from the slot shape (keys + column assignment).
  // Observers are only ever torn down/recreated when THIS changes, not when
  // the `slots` array identity changes.
  const slotsKey = slots.map((slot) => `${slot.key}:${slot.column}`).join('|');

  // Track the `lg` breakpoint.
  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return;
    }
    const mql = window.matchMedia(BREAKPOINT_QUERY);
    const onChange = () => setActive(mql.matches);
    onChange();
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, []);

  // Measure every slot synchronously before first paint, then keep one
  // ResizeObserver per slot for later size changes (image loads, font swaps,
  // content edits). The synchronous pass matters: some engines (seen on
  // Linux WebKit) deliver the first ResizeObserver notification well after
  // first paint, and until it arrives every card would sit at `top: 0`.
  useLayoutEffect(() => {
    if (!active) {
      setReady(false);
      return;
    }

    const nodedSlots = slotsRef.current.filter((slot) => slot.ref.current != null);

    const measured: Record<string, number> = {};
    for (const slot of nodedSlots) {
      measured[slot.key] = (slot.ref.current as HTMLElement).getBoundingClientRect().height;
    }
    setHeights((prev) =>
      Object.keys(measured).every((key) => prev[key] === measured[key])
        ? prev
        : { ...prev, ...measured },
    );
    setReady(true);

    if (typeof ResizeObserver !== 'function') return;

    const observers = nodedSlots.map((slot) => {
      const observer = new ResizeObserver((entries) => {
        const entry = entries[0];
        if (!entry) return;
        const height = entry.contentRect.height;
        setHeights((prev) =>
          prev[slot.key] === height ? prev : { ...prev, [slot.key]: height },
        );
      });
      observer.observe(slot.ref.current as HTMLElement);
      return observer;
    });

    return () => {
      observers.forEach((observer) => observer.disconnect());
    };
  }, [active, slotsKey]);

  const { offsets, maxHeight } = useMemo(() => {
    const runningByColumn: Record<ColumnSlotColumn, number> = { rail: 0, content: 0 };
    const nextOffsets: Record<string, number> = {};

    for (const slot of slots) {
      nextOffsets[slot.key] = runningByColumn[slot.column];
      const height = heights[slot.key] ?? 0;
      runningByColumn[slot.column] += height + CARD_GAP_PX;
    }

    const railHeight = Math.max(0, runningByColumn.rail - CARD_GAP_PX);
    const contentHeight = Math.max(0, runningByColumn.content - CARD_GAP_PX);

    return { offsets: nextOffsets, maxHeight: Math.max(railHeight, contentHeight) };
  }, [slots, heights]);

  const slotsByKey = useMemo(() => new Map(slots.map((slot) => [slot.key, slot])), [slots]);

  const styleFor = useCallback(
    (key: string): CSSProperties => {
      if (!active) return {};
      const slot = slotsByKey.get(key);
      if (!slot) return {};

      const top = offsets[key] ?? 0;

      if (slot.column === 'rail') {
        return { position: 'absolute', top, left: 0, width: RAIL_WIDTH };
      }

      return {
        position: 'absolute',
        top,
        left: `calc(${RAIL_WIDTH} + ${COLUMN_GAP})`,
        right: 0,
      };
    },
    [active, offsets, slotsByKey],
  );

  const containerStyle = useMemo((): CSSProperties => {
    if (!active) return {};
    return { position: 'relative', height: maxHeight };
  }, [active, maxHeight]);

  return { styleFor, containerStyle, ready };
}
