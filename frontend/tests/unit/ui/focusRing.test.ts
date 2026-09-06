import { describe, expect, it } from 'vitest';

import { focusRing } from '../../../src/components/ui/focusRing';

describe('focusRing', () => {
  it('is the single canonical focus-visible treatment (spec 059 US5 / FR-014)', () => {
    expect(focusRing).toBe(
      'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2',
    );
  });

  it('is a stable string constant', () => {
    expect(typeof focusRing).toBe('string');
  });
});
