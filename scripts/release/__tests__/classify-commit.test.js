'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { classifyCommit } = require('../classify-commit');

function parsed(overrides) {
  return { type: null, scope: null, description: '', breaking: false, malformed: false, ...overrides };
}

test('feat commit qualifies, bumps minor, categorizes as Added', () => {
  const result = classifyCommit(parsed({ type: 'feat', description: 'add filters' }));
  assert.equal(result.qualifies, true);
  assert.equal(result.bumpLevel, 'minor');
  assert.equal(result.changelogCategory, 'Added');
});

test('fix commit qualifies, bumps patch, categorizes as Fixed', () => {
  const result = classifyCommit(parsed({ type: 'fix', description: 'fix pagination' }));
  assert.equal(result.qualifies, true);
  assert.equal(result.bumpLevel, 'patch');
  assert.equal(result.changelogCategory, 'Fixed');
});

test('breaking feat commit bumps major', () => {
  const result = classifyCommit(parsed({ type: 'feat', breaking: true, description: 'require link' }));
  assert.equal(result.qualifies, true);
  assert.equal(result.bumpLevel, 'major');
  assert.equal(result.changelogCategory, 'Added');
});

for (const excludedType of ['chore', 'docs', 'test', 'ci', 'style', 'refactor']) {
  test(`${excludedType} commit without "!" does not qualify (FR-010)`, () => {
    const result = classifyCommit(parsed({ type: excludedType, description: 'housekeeping' }));
    assert.equal(result.qualifies, false);
    assert.equal(result.bumpLevel, 'none');
    assert.equal(result.changelogCategory, null);
  });

  test(`${excludedType} commit with "!" (breaking) qualifies as major (FR-010 override)`, () => {
    const result = classifyCommit(parsed({ type: excludedType, breaking: true, description: 'breaking housekeeping' }));
    assert.equal(result.qualifies, true);
    assert.equal(result.bumpLevel, 'major');
    assert.equal(result.changelogCategory, 'Changed');
  });
}

test('a qualifying type that is neither feat nor fix (e.g. perf) categorizes as Changed', () => {
  const result = classifyCommit(parsed({ type: 'perf', description: 'speed up search' }));
  assert.equal(result.qualifies, true);
  assert.equal(result.bumpLevel, 'patch');
  assert.equal(result.changelogCategory, 'Changed');
});

test('a malformed commit never qualifies regardless of any other field', () => {
  const result = classifyCommit(parsed({ type: null, malformed: true, description: 'updated stuff' }));
  assert.equal(result.qualifies, false);
  assert.equal(result.bumpLevel, 'none');
  assert.equal(result.changelogCategory, null);
});
