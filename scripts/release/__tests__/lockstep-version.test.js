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

test('flutter_app/pubspec.yaml version matches the backend/frontend version (lockstep invariant)', () => {
  const fs = require('node:fs');
  const { readPubspecVersion } = require('../pubspec-version');
  const backendPkg = require(path.join(REPO_ROOT, 'backend', 'package.json'));
  const pubspec = fs.readFileSync(path.join(REPO_ROOT, 'flutter_app', 'pubspec.yaml'), 'utf8');

  assert.equal(readPubspecVersion(pubspec).version, backendPkg.version, 'flutter_app version must match backend/frontend');
});
