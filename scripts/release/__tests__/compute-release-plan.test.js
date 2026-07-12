'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { computeReleasePlan } = require('../compute-release-plan');

function commit(overrides) {
  return {
    sha: 'abcdef1234567890',
    type: 'fix',
    scope: null,
    description: 'a change',
    breaking: false,
    malformed: false,
    qualifies: true,
    bumpLevel: 'patch',
    changelogCategory: 'Fixed',
    ...overrides,
  };
}

test('highest-impact bump wins across a mixed batch (breaking > feat > fix)', () => {
  const commits = [
    commit({ bumpLevel: 'patch', changelogCategory: 'Fixed' }),
    commit({ type: 'feat', bumpLevel: 'minor', changelogCategory: 'Added' }),
  ];
  const plan = computeReleasePlan(commits, '1.2.3', '2026-07-13');
  assert.equal(plan.bumpLevel, 'minor');
  assert.equal(plan.nextVersion, '1.3.0');
});

test('a breaking commit forces major even alongside feat/fix commits', () => {
  const commits = [
    commit({ bumpLevel: 'patch', changelogCategory: 'Fixed' }),
    commit({ type: 'feat', bumpLevel: 'minor', changelogCategory: 'Added' }),
    commit({ type: 'feat', breaking: true, bumpLevel: 'major', changelogCategory: 'Added' }),
  ];
  const plan = computeReleasePlan(commits, '1.2.3', '2026-07-13');
  assert.equal(plan.bumpLevel, 'major');
  assert.equal(plan.nextVersion, '2.0.0');
});

test('a batch of only non-qualifying commits is a no-op (FR-010)', () => {
  const commits = [
    commit({ type: 'chore', qualifies: false, bumpLevel: 'none', changelogCategory: null }),
    commit({ type: 'docs', qualifies: false, bumpLevel: 'none', changelogCategory: null }),
  ];
  const plan = computeReleasePlan(commits, '1.2.3', '2026-07-13');
  assert.equal(plan.bumpLevel, 'none');
  assert.equal(plan.nextVersion, null);
  assert.deepEqual(plan.entries, []);
});

test('malformed commits are collected as warnings and excluded from entries/bump', () => {
  const commits = [
    commit({ type: 'feat', bumpLevel: 'minor', changelogCategory: 'Added' }),
    commit({
      sha: '1111111',
      type: null,
      malformed: true,
      qualifies: false,
      bumpLevel: 'none',
      changelogCategory: null,
      description: 'updated some stuff',
    }),
  ];
  const plan = computeReleasePlan(commits, '1.2.3', '2026-07-13');
  assert.equal(plan.bumpLevel, 'minor');
  assert.equal(plan.entries.length, 1);
  assert.equal(plan.warnings.length, 1);
  assert.match(plan.warnings[0], /1111111/);
  assert.match(plan.warnings[0], /updated some stuff/);
});

test('entries carry commit short SHA and category (SC-004 traceability)', () => {
  const commits = [commit({ sha: 'abcdef1234567890', type: 'fix', changelogCategory: 'Fixed', description: 'fix thing' })];
  const plan = computeReleasePlan(commits, '1.2.3', '2026-07-13');
  assert.equal(plan.entries[0].commitSha, 'abcdef1');
  assert.equal(plan.entries[0].category, 'Fixed');
  assert.equal(plan.entries[0].description, 'fix thing');
  assert.equal(plan.entries[0].sourcePackage, 'unified');
});
