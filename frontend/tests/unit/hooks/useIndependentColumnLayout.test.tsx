import { useRef } from 'react';
import { act, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  useIndependentColumnLayout,
  type ColumnSlot,
  type ColumnSlotColumn,
  type UseIndependentColumnLayoutResult,
} from '../../../src/hooks/useIndependentColumnLayout';

/**
 * Contract tests for `useIndependentColumnLayout` (feature 065, US1, T002).
 * See specs/065-fix-detail-column-gaps/contracts/useIndependentColumnLayout.contract.md
 * "Test expectations".
 */

interface MockResizeObserverInstance {
  callback: ResizeObserverCallback;
  observe: ReturnType<typeof vi.fn>;
  unobserve: ReturnType<typeof vi.fn>;
  disconnect: ReturnType<typeof vi.fn>;
}

let roInstances: MockResizeObserverInstance[];

class MockResizeObserver implements ResizeObserver {
  callback: ResizeObserverCallback;
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();

  constructor(callback: ResizeObserverCallback) {
    this.callback = callback;
    roInstances.push(this);
  }
}

function fire(index: number, height: number) {
  act(() => {
    roInstances[index]?.callback(
      [{ contentRect: { height } } as ResizeObserverEntry],
      roInstances[index] as unknown as ResizeObserver,
    );
  });
}

let mediaListeners: Array<() => void>;
let removeEventListenerSpy: ReturnType<typeof vi.fn>;

function installMatchMedia(matches: boolean) {
  mediaListeners = [];
  removeEventListenerSpy = vi.fn((_type: string, listener: () => void) => {
    mediaListeners = mediaListeners.filter((l) => l !== listener);
  });

  vi.spyOn(window, 'matchMedia').mockImplementation((query: string) => ({
    matches,
    media: query,
    onchange: null,
    addEventListener: vi.fn((_type: string, listener: () => void) => {
      mediaListeners.push(listener);
    }),
    removeEventListener: removeEventListenerSpy,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(() => false),
  }));
}

interface HarnessSlotDef {
  key: string;
  column: ColumnSlotColumn;
}

let lastResult: UseIndependentColumnLayoutResult | undefined;

function Harness({ slots }: { slots: HarnessSlotDef[] }) {
  const ref0 = useRef<HTMLDivElement>(null);
  const ref1 = useRef<HTMLDivElement>(null);
  const ref2 = useRef<HTMLDivElement>(null);
  const ref3 = useRef<HTMLDivElement>(null);
  const refs = [ref0, ref1, ref2, ref3];

  const columnSlots: ColumnSlot[] = slots.map((s, i) => ({
    key: s.key,
    column: s.column,
    ref: refs[i],
  }));

  const result = useIndependentColumnLayout(columnSlots);
  lastResult = result;

  return (
    <div data-testid="container" style={result.containerStyle}>
      {slots.map((s, i) => (
        <div key={s.key} data-testid={s.key} ref={refs[i]} style={result.styleFor(s.key)} />
      ))}
    </div>
  );
}

beforeEach(() => {
  roInstances = [];
  vi.stubGlobal('ResizeObserver', MockResizeObserver);
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  lastResult = undefined;
});

describe('useIndependentColumnLayout', () => {
  it('stacks two same-column slots with exactly the design system card gap, regardless of the other column', () => {
    installMatchMedia(true);

    const { getByTestId } = render(
      <Harness
        slots={[
          { key: 'rail1', column: 'rail' },
          { key: 'rail2', column: 'rail' },
          { key: 'content1', column: 'content' },
        ]}
      />,
    );

    fire(0, 40); // rail1
    fire(2, 900); // content1 — deliberately tall, in the OTHER column

    // rail2 stacks directly under rail1 with the card gap — never the
    // 900px-tall content1 card's height.
    expect(getByTestId('rail1').style.top).toBe('0px');
    expect(getByTestId('rail2').style.top).toBe(`${40 + 24}px`);
    expect(getByTestId('content1').style.top).toBe('0px');
  });

  it('shifts only the same-column slots below a slot whose height changes after mount', () => {
    installMatchMedia(true);

    const { getByTestId } = render(
      <Harness
        slots={[
          { key: 'content1', column: 'content' },
          { key: 'content2', column: 'content' },
          { key: 'rail1', column: 'rail' },
          { key: 'rail2', column: 'rail' },
        ]}
      />,
    );

    fire(0, 100); // content1
    fire(2, 200); // rail1

    expect(getByTestId('content2').style.top).toBe(`${100 + 24}px`);
    expect(getByTestId('rail2').style.top).toBe(`${200 + 24}px`);

    // content1 grows — only content2 (same column, below it) should move.
    fire(0, 300);

    expect(getByTestId('content2').style.top).toBe(`${300 + 24}px`);
    // rail2's position is untouched by the content-column resize.
    expect(getByTestId('rail2').style.top).toBe(`${200 + 24}px`);
  });

  it('returns {} styles for every slot below the lg breakpoint', () => {
    installMatchMedia(false);

    render(
      <Harness
        slots={[
          { key: 'rail1', column: 'rail' },
          { key: 'content1', column: 'content' },
        ]}
      />,
    );

    expect(lastResult?.styleFor('rail1')).toEqual({});
    expect(lastResult?.styleFor('content1')).toEqual({});
    expect(lastResult?.containerStyle).toEqual({});
  });

  it('disconnects every ResizeObserver and removes the matchMedia listener on unmount', () => {
    installMatchMedia(true);

    const { unmount } = render(
      <Harness
        slots={[
          { key: 'rail1', column: 'rail' },
          { key: 'content1', column: 'content' },
        ]}
      />,
    );

    expect(roInstances).toHaveLength(2);
    expect(mediaListeners).toHaveLength(1);

    unmount();

    for (const instance of roInstances) {
      expect(instance.disconnect).toHaveBeenCalledTimes(1);
    }
    expect(removeEventListenerSpy).toHaveBeenCalledWith('change', expect.any(Function));
  });
});
