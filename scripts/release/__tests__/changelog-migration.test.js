'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.join(__dirname, '..', '..', '..');
const ROOT_CHANGELOG = path.join(REPO_ROOT, 'CHANGELOG.md');
const BACKEND_CHANGELOG = path.join(REPO_ROOT, 'backend', 'CHANGELOG.md');
const FRONTEND_CHANGELOG = path.join(REPO_ROOT, 'frontend', 'CHANGELOG.md');

function countHeadings(content) {
  const matches = content.match(/^## \[/gm);
  return matches ? matches.length : 0;
}

test('root CHANGELOG.md exists', () => {
  assert.equal(fs.existsSync(ROOT_CHANGELOG), true, 'expected CHANGELOG.md at repo root');
});

test('root CHANGELOG.md marks the unified-versioning start before the historical section', () => {
  const content = fs.readFileSync(ROOT_CHANGELOG, 'utf8');
  const unifiedIndex = content.indexOf('## Unified versioning');
  const historicalIndex = content.indexOf('## Historical merged entries');

  assert.ok(unifiedIndex !== -1, 'expected a "## Unified versioning" marker section');
  assert.ok(historicalIndex !== -1, 'expected a "## Historical merged entries" section');
  assert.ok(
    unifiedIndex < historicalIndex,
    'expected "## Unified versioning" to appear before "## Historical merged entries"'
  );
});

test('root CHANGELOG.md contains at least as many version headings as the two merged files combined', () => {
  const rootContent = fs.readFileSync(ROOT_CHANGELOG, 'utf8');
  const backendContent = fs.readFileSync(BACKEND_CHANGELOG, 'utf8');
  const frontendContent = fs.readFileSync(FRONTEND_CHANGELOG, 'utf8');

  const rootCount = countHeadings(rootContent);
  const combinedCount = countHeadings(backendContent) + countHeadings(frontendContent);

  assert.ok(
    rootCount >= combinedCount,
    `expected root CHANGELOG.md to have >= ${combinedCount} version headings, found ${rootCount}`
  );
});
