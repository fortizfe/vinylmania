'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { parseCommit } = require('../parse-commit');

test('parses a simple feat commit', () => {
  const result = parseCommit('feat: add search filters', '');
  assert.equal(result.type, 'feat');
  assert.equal(result.scope, null);
  assert.equal(result.description, 'add search filters');
  assert.equal(result.breaking, false);
  assert.equal(result.malformed, false);
});

test('parses a scoped fix commit', () => {
  const result = parseCommit('fix(search): correct pagination off-by-one', '');
  assert.equal(result.type, 'fix');
  assert.equal(result.scope, 'search');
  assert.equal(result.description, 'correct pagination off-by-one');
  assert.equal(result.breaking, false);
});

test('detects breaking change via "!" suffix', () => {
  const result = parseCommit('feat(library)!: require Discogs link for all writes', '');
  assert.equal(result.type, 'feat');
  assert.equal(result.scope, 'library');
  assert.equal(result.breaking, true);
  assert.equal(result.description, 'require Discogs link for all writes');
});

test('detects breaking change via BREAKING CHANGE footer', () => {
  const result = parseCommit('refactor(api): rename response field', 'BREAKING CHANGE: `id` renamed to `discogsId`');
  assert.equal(result.type, 'refactor');
  assert.equal(result.breaking, true);
});

test('flags a malformed subject with no recognizable Conventional Commit type', () => {
  const result = parseCommit('updated some stuff', '');
  assert.equal(result.malformed, true);
  assert.equal(result.type, null);
  assert.equal(result.scope, null);
  assert.equal(result.breaking, false);
  assert.equal(result.description, 'updated some stuff');
});
