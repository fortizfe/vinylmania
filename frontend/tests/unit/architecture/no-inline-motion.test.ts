import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * Spec 059 FR-006 — "one shared token set". Every animated component pulls
 * its curve / duration / spring from `frontend/src/motion/tokens.ts` (or the
 * `--ease-*` / `--motion-duration-*` custom properties that mirror it), never
 * a hand-tuned value inline. This scan fails the build when a component file
 * grows a raw `cubic-bezier()`, an arbitrary/hard-coded Tailwind
 * `duration-*`, a `transition-all`, or a bare non-token easing class.
 *
 * Allowed:
 * - `duration-(--motion-duration-*)`  (Tailwind v4 CSS-var shorthand → token)
 * - `ease-out` / `ease-in-out` / `ease-drawer`  (these three utilities are
 *   redefined by the `@theme` block in `global.css` to the research R2 curves)
 * - any spring/transition config imported from `frontend/src/motion/`
 */

const componentsDir = join(process.cwd(), 'src', 'components');

/** Strip `//` line comments and `/* *\/` block comments so the explanatory
 * prose in a component file can't trip a rule. */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
}

const RULES: { re: RegExp; label: string }[] = [
  {
    re: /cubic-bezier\(/,
    label: 'raw cubic-bezier() — use an easing token (easing.* / ease-out util)',
  },
  {
    re: /transition-all|transition:\s*all/,
    label: 'transition-all — enumerate the animated properties instead',
  },
  {
    re: /\bduration-\[/,
    label: 'arbitrary duration-[…] — use duration-(--motion-duration-*)',
  },
  {
    re: /\bduration-\d/,
    label: 'hard-coded duration-<n> — use a --motion-duration-* token',
  },
  { re: /\bease-\[/, label: 'arbitrary ease-[…] — use an easing token' },
  {
    re: /\bease-in(?![-\w])/,
    label: 'bare `ease-in` — use the ease-in-out / ease-out token utility',
  },
  { re: /\bease-linear\b/, label: 'ease-linear — use an easing token' },
  { re: /\bease-initial\b/, label: 'ease-initial — use an easing token' },
];

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

describe('no inline motion values in components (FR-006)', () => {
  it('every component sources its motion from the shared token set', () => {
    const offenders: string[] = [];

    for (const file of collectSourceFiles(componentsDir)) {
      const contents = stripComments(readFileSync(file, 'utf8'));
      for (const { re, label } of RULES) {
        if (re.test(contents)) {
          offenders.push(`${relative(componentsDir, file)} — ${label}`);
        }
      }
    }

    expect(
      offenders,
      `Inline motion values found — route them through frontend/src/motion/ tokens:\n${offenders.join('\n')}`,
    ).toEqual([]);
  });
});
