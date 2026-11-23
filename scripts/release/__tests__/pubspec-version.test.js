'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { readPubspecVersion, bumpPubspecVersion } = require('../pubspec-version');

const PUBSPEC = 'name: vinylmania\nversion: 1.14.0+3\n\nenvironment:\n  sdk: ^3.14.0\n';

test('reads the semver and build number of the version line', () => {
  assert.deepEqual(readPubspecVersion(PUBSPEC), { version: '1.14.0', build: 3 });
});

test('bump sets the new version and increments the build number, leaving the rest untouched', () => {
  assert.equal(
    bumpPubspecVersion(PUBSPEC, '1.15.0'),
    'name: vinylmania\nversion: 1.15.0+4\n\nenvironment:\n  sdk: ^3.14.0\n'
  );
});

test('throws when the pubspec has no x.y.z+build version line', () => {
  assert.throws(() => readPubspecVersion('name: vinylmania\nversion: 1.14.0\n'), /version/);
});
