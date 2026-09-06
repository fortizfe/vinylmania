import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * Constitution IV (Dependency Inversion) + spec 059 FR-006a: the `motion`
 * gesture/animation library is a single swappable seam. Only files under
 * `frontend/src/motion/` may import it — every component and page must
 * depend on that wrapper's API instead.
 */

const srcDir = join(process.cwd(), 'src');

const SCANNED_DIRS = ['components', 'pages'];

// Matches `import ... from 'motion'` / `'motion/react'` / `'framer-motion'`
// and `require('motion')` / dynamic `import('motion/react')`.
const FORBIDDEN_IMPORT =
  /(?:import|export)[^;]*?from\s*['"](motion|framer-motion)(?:\/[\w-]+)*['"]|(?:require|import)\(\s*['"](motion|framer-motion)(?:\/[\w-]+)*['"]\s*\)/;

function collectSourceFiles(dir: string): string[] {
  const entries = readdirSync(dir);
  const files: string[] = [];

  for (const entry of entries) {
    const fullPath = join(dir, entry);
    if (statSync(fullPath).isDirectory()) {
      files.push(...collectSourceFiles(fullPath));
      continue;
    }
    if (/\.(ts|tsx)$/.test(entry)) files.push(fullPath);
  }

  return files;
}

describe('motion import boundary', () => {
  it('no component or page imports `motion` / `framer-motion` directly', () => {
    const offenders: string[] = [];

    for (const scanned of SCANNED_DIRS) {
      const dir = join(srcDir, scanned);
      let files: string[];
      try {
        files = collectSourceFiles(dir);
      } catch {
        // `pages/` may not exist in every checkout — skip if absent.
        continue;
      }

      for (const file of files) {
        const contents = readFileSync(file, 'utf8');
        if (FORBIDDEN_IMPORT.test(contents)) {
          offenders.push(relative(srcDir, file));
        }
      }
    }

    expect(
      offenders,
      `These files import the motion library directly — route them through frontend/src/motion/ instead:\n${offenders.join('\n')}`,
    ).toEqual([]);
  });

  it('the motion wrapper module exists and is the sanctioned home for the library', () => {
    const wrapperEntry = join(srcDir, 'motion', 'index.ts');
    expect(statSync(wrapperEntry).isFile()).toBe(true);
  });
});
