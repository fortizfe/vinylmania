import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { dismiss, easing, motionDuration, spring } from '../../../src/motion/tokens';

const globalCss = readFileSync(join(process.cwd(), 'src/styles/global.css'), 'utf8');

function cssVar(name: string): string | undefined {
  const match = globalCss.match(
    new RegExp(`${name.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}:\\s*([^;]+);`),
  );
  return match?.[1].trim();
}

describe('motion tokens', () => {
  it('exposes the spring configs from the contract', () => {
    expect(spring.default).toEqual({ type: 'spring', duration: 0.4, bounce: 0 });
    expect(spring.sheet).toEqual({ type: 'spring', duration: 0.35, bounce: 0 });
    expect(spring.momentum).toEqual({ type: 'spring', duration: 0.5, bounce: 0.2 });
  });

  it('only the momentum spring is allowed a non-zero bounce (apple-design §4)', () => {
    expect(spring.default.bounce).toBe(0);
    expect(spring.sheet.bounce).toBe(0);
    expect(spring.momentum.bounce).toBeGreaterThan(0);
  });

  it('exposes the duration constants (ms) from the contract', () => {
    expect(motionDuration).toEqual({
      press: 130,
      fade: 200,
      collapse: 200,
      drawer: 250,
    });
  });

  it('exposes the easing curves from the contract', () => {
    expect(easing.out).toBe('cubic-bezier(0.23, 1, 0.32, 1)');
    expect(easing.inOut).toBe('cubic-bezier(0.77, 0, 0.175, 1)');
    expect(easing.drawer).toBe('cubic-bezier(0.32, 0.72, 0, 1)');
  });

  it('exposes the drag-to-dismiss thresholds from the contract', () => {
    expect(dismiss).toEqual({ distanceRatio: 0.45, velocity: 500, elastic: 0.15 });
  });

  it('freezes every token object (as const / Object.freeze)', () => {
    expect(Object.isFrozen(spring)).toBe(true);
    expect(Object.isFrozen(spring.default)).toBe(true);
    expect(Object.isFrozen(motionDuration)).toBe(true);
    expect(Object.isFrozen(easing)).toBe(true);
    expect(Object.isFrozen(dismiss)).toBe(true);
  });

  it('mirrors the easing custom properties declared in global.css exactly', () => {
    expect(cssVar('--ease-out')).toBe(easing.out);
    expect(cssVar('--ease-in-out')).toBe(easing.inOut);
    expect(cssVar('--ease-drawer')).toBe(easing.drawer);
  });

  it('mirrors the motion-duration custom properties declared in global.css exactly', () => {
    expect(cssVar('--motion-duration-press')).toBe(`${motionDuration.press}ms`);
    expect(cssVar('--motion-duration-fade')).toBe(`${motionDuration.fade}ms`);
    expect(cssVar('--motion-duration-collapse')).toBe(`${motionDuration.collapse}ms`);
    expect(cssVar('--motion-duration-drawer')).toBe(`${motionDuration.drawer}ms`);
  });
});
