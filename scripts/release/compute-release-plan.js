'use strict';

const BUMP_PRIORITY = { major: 3, minor: 2, patch: 1, none: 0 };

function bumpVersion(version, level) {
  const [major, minor, patch] = version.split('.').map(Number);
  if (level === 'major') return `${major + 1}.0.0`;
  if (level === 'minor') return `${major}.${minor + 1}.0`;
  return `${major}.${minor}.${patch + 1}`;
}

function highestBumpLevel(commits) {
  let highest = 'none';
  for (const commit of commits) {
    if (BUMP_PRIORITY[commit.bumpLevel] > BUMP_PRIORITY[highest]) {
      highest = commit.bumpLevel;
    }
  }
  return highest;
}

/**
 * Computes a ReleasePlan from a batch of ClassifiedCommits.
 * @param {Array<object>} commits
 * @param {string} previousVersion
 * @param {string} date
 */
function computeReleasePlan(commits, previousVersion, date) {
  const warnings = commits
    .filter((commit) => commit.malformed)
    .map((commit) => {
      const shortSha = commit.sha ? commit.sha.slice(0, 7) : '(unknown sha)';
      return `Commit ${shortSha} does not follow Conventional Commits and was skipped: "${commit.description}"`;
    });

  const qualifying = commits.filter((commit) => commit.qualifies);

  if (qualifying.length === 0) {
    return { previousVersion, bumpLevel: 'none', nextVersion: null, date, entries: [], warnings };
  }

  const bumpLevel = highestBumpLevel(qualifying);
  const nextVersion = bumpVersion(previousVersion, bumpLevel);

  const entries = qualifying.map((commit) => ({
    category: commit.changelogCategory,
    description: commit.description,
    sourcePackage: 'unified',
    originalVersion: null,
    commitSha: commit.sha ? commit.sha.slice(0, 7) : null,
  }));

  return { previousVersion, bumpLevel, nextVersion, date, entries, warnings };
}

module.exports = { computeReleasePlan, bumpVersion };
