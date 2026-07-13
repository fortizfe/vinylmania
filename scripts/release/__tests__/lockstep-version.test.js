'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const REPO_ROOT = path.join(__dirname, '..', '..', '..');

test('backend and frontend package.json versions match each other (lockstep invariant)', () => {
  const backendPkg = require(path.join(REPO_ROOT, 'backend', 'package.json'));
  const frontendPkg = require(path.join(REPO_ROOT, 'frontend', 'package.json'));

  assert.equal(backendPkg.version, frontendPkg.version, 'backend and frontend versions must always match');
});
