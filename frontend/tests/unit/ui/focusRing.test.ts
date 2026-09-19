import { describe, expect, it } from 'vitest';

import { focusRing } from '../../../src/components/ui/focusRing';

describe('focusRing', () => {
  it('is the single canonical focus-visible treatment (spec 059 US5 / FR-014)', () => {
    expect(focusRing).toBe(
      'focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2',
    );
  });

  it('stays visible under forced colours: never `outline-none`, which leaves nothing once the box-shadow ring is stripped (WCAG 2.4.7, spec 067 T050 #1)', () => {
    // Tailwind v4 `outline-hidden` paints a transparent 2px outline only under
    // `forced-colors: active`, where the system colour makes it visible.
    expect(focusRing).toContain('focus-visible:outline-hidden');
    expect(focusRing).not.toMatch(/outline-none/);
  });

  it('is a stable string constant', () => {
    expect(typeof focusRing).toBe('string');
  });
});
