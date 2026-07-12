'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { renderChangelogSection } = require('../render-changelog-section');

test('renders a version heading with grouped categories in Added/Changed/Fixed order', () => {
  const plan = {
    previousVersion: '0.22.1',
    bumpLevel: 'minor',
    nextVersion: '0.23.0',
    date: '2026-07-13',
    entries: [
      { category: 'Fixed', description: 'fix thing', sourcePackage: 'unified', originalVersion: null, commitSha: 'aaa1111' },
      { category: 'Added', description: 'add thing', sourcePackage: 'unified', originalVersion: null, commitSha: 'bbb2222' },
      { category: 'Changed', description: 'change thing', sourcePackage: 'unified', originalVersion: null, commitSha: 'ccc3333' },
    ],
    warnings: [],
  };

  const section = renderChangelogSection(plan);

  assert.match(section, /^## \[0\.23\.0\] - 2026-07-13/);
  const addedIndex = section.indexOf('### Added');
  const changedIndex = section.indexOf('### Changed');
  const fixedIndex = section.indexOf('### Fixed');
  assert.ok(addedIndex !== -1 && changedIndex !== -1 && fixedIndex !== -1);
  assert.ok(addedIndex < changedIndex && changedIndex < fixedIndex, 'expected Added, then Changed, then Fixed');
  assert.match(section, /- add thing \(\[bbb2222\]\)/);
  assert.match(section, /- change thing \(\[ccc3333\]\)/);
  assert.match(section, /- fix thing \(\[aaa1111\]\)/);
});

test('omits empty categories', () => {
  const plan = {
    previousVersion: '0.22.1',
    bumpLevel: 'patch',
    nextVersion: '0.22.2',
    date: '2026-07-13',
    entries: [{ category: 'Fixed', description: 'fix only', sourcePackage: 'unified', originalVersion: null, commitSha: 'ddd4444' }],
    warnings: [],
  };

  const section = renderChangelogSection(plan);

  assert.equal(section.includes('### Added'), false);
  assert.equal(section.includes('### Changed'), false);
  assert.match(section, /### Fixed/);
});

test('returns an empty string for a no-op plan', () => {
  const plan = { previousVersion: '0.22.1', bumpLevel: 'none', nextVersion: null, date: '2026-07-13', entries: [], warnings: [] };
  assert.equal(renderChangelogSection(plan), '');
});
