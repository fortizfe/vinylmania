import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * Spec 059 FR-014 / US5 — "a single shared focus-indicator treatment across
 * the app". Every interactive control renders the one canonical
 * `focusRing` constant from `src/components/ui/focusRing.ts`; no component
 * file may hand-roll a focus-visible ring or carry one of the historical
 * variants (`outline-primary`, ad-hoc `focus:ring-*` / `focus-visible:ring-*`).
 *
 * The scan is a literal-source check: a file that composes `focusRing`
 * (imported constant) has no such literal, so it passes; a file with its own
 * `focus:ring-primary` etc. fails and must adopt `focusRing` instead.
 *
 * Allowed:
 * - `focusRing.ts` itself — it defines the canonical string.
 * - `focus:border-primary` + `focus:outline-none` on text inputs — the
 *   distinct input-field focus treatment (a border-color change, not a ring),
 *   kept deliberately (spec 059 T085 / contracts §`ui/Input`).
 * - a line carrying a `focus-ring-consistency-allow` comment marker — a
 *   genuinely-justified, documented exception.
 */

const componentsDir = join(process.cwd(), 'src', 'components');

const ALLOWED_FILES = new Set([join('ui', 'focusRing.ts')]);

/** Focus treatments that are NOT the shared `focusRing`. */
const RULES: { re: RegExp; label: string }[] = [
  {
    re: /focus-visible:ring-/,
    label:
      'inline focus-visible:ring-* — compose the shared `focusRing` constant instead',
  },
  {
    re: /focus-visible:outline-/,
    label:
      'inline focus-visible:outline-* — compose the shared `focusRing` constant instead',
  },
  {
    re: /\bfocus:ring-/,
    label: 'ad-hoc focus:ring-* — compose the shared `focusRing` constant instead',
  },
  {
    re: /outline-primary/,
    label:
      'legacy `outline-primary` focus treatment — compose the shared `focusRing` constant instead',
  },
];

/** Strip comments so explanatory prose (incl. the words above) can't trip a rule. */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
}

function collectSourceFiles(dir: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      files.push(...collectSourceFiles(full));
    } else if (/\.(ts|tsx)$/.test(entry) && !/\.test\.(ts|tsx)$/.test(entry)) {
      files.push(full);
    }
  }
  return files;
}

describe('focus-ring consistency (FR-014 / US5)', () => {
  it('the only focus-visible treatment in components/** is the shared `focusRing`', () => {
    const offenders: string[] = [];

    for (const file of collectSourceFiles(componentsDir)) {
      const rel = relative(componentsDir, file);
      if (ALLOWED_FILES.has(rel)) continue;

      const source = readFileSync(file, 'utf8');
      const scannable = stripComments(source)
        .split('\n')
        .filter((line) => !line.includes('focus-ring-consistency-allow'))
        .join('\n');

      for (const { re, label } of RULES) {
        if (re.test(scannable)) offenders.push(`${rel} — ${label}`);
      }
    }

    expect(
      offenders,
      `Non-canonical focus treatments found — replace with the shared \`focusRing\`:\n${offenders.join('\n')}`,
    ).toEqual([]);
  });
});
