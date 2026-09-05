import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import type { Result } from 'axe-core';

export interface RunAxeScanOptions {
  /** axe-core rule tags to scan against. Defaults to WCAG 2.1 A/AA. */
  tags?: string[];
}

/**
 * Runs an axe-core accessibility scan against `page` and returns only the
 * `serious`/`critical` violations (axe's `minor`/`moderate` impacts are
 * noisy for a hard merge gate and are intentionally excluded here, matching
 * the pattern already established in `sign-in.spec.ts` for FR-010/SC-006).
 *
 * Deliberately does not assert — callers call `expect(violations).toEqual([])`
 * themselves, so each screen's test can carry its own descriptive failure
 * context (which screen/theme it's scanning).
 */
export async function runAxeScan(page: Page, options?: RunAxeScanOptions): Promise<Result[]> {
  const results = await new AxeBuilder({ page })
    .withTags(options?.tags ?? ['wcag2a', 'wcag2aa'])
    .analyze();

  return results.violations.filter(
    (violation) => violation.impact === 'serious' || violation.impact === 'critical',
  );
}
