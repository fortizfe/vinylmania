'use strict';

const VERSION_LINE = /^version:[ \t]*(\d+\.\d+\.\d+)\+(\d+)[ \t]*$/m;

/**
 * Reads `version: x.y.z+build` from a pubspec.yaml's content.
 * @param {string} content
 * @returns {{version: string, build: number}}
 */
function readPubspecVersion(content) {
  const match = VERSION_LINE.exec(content);
  if (!match) {
    throw new Error('pubspec.yaml has no "version: x.y.z+build" line');
  }
  return { version: match[1], build: Number(match[2]) };
}

/**
 * Sets the semver part to `nextVersion` and increments the build number
 * (Android versionCode / iOS CFBundleVersion must grow on every release).
 * @param {string} content
 * @param {string} nextVersion
 * @returns {string}
 */
function bumpPubspecVersion(content, nextVersion) {
  const { build } = readPubspecVersion(content);
  return content.replace(VERSION_LINE, `version: ${nextVersion}+${build + 1}`);
}

module.exports = { readPubspecVersion, bumpPubspecVersion };
