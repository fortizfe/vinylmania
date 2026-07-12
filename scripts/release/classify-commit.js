'use strict';

const NON_QUALIFYING_TYPES = new Set(['chore', 'docs', 'test', 'ci', 'style', 'refactor']);

/**
 * Adds qualifies/bumpLevel/changelogCategory to a parsed commit, per FR-007,
 * FR-009, and FR-010, and the Clarifications category mapping.
 * @param {{type: string|null, scope: string|null, description: string, breaking: boolean, malformed: boolean}} parsed
 */
function classifyCommit(parsed) {
  if (parsed.malformed) {
    return { ...parsed, qualifies: false, bumpLevel: 'none', changelogCategory: null };
  }

  const qualifies = parsed.breaking || !NON_QUALIFYING_TYPES.has(parsed.type);

  if (!qualifies) {
    return { ...parsed, qualifies: false, bumpLevel: 'none', changelogCategory: null };
  }

  let bumpLevel;
  if (parsed.breaking) {
    bumpLevel = 'major';
  } else if (parsed.type === 'feat') {
    bumpLevel = 'minor';
  } else {
    bumpLevel = 'patch';
  }

  let changelogCategory;
  if (parsed.type === 'feat') {
    changelogCategory = 'Added';
  } else if (parsed.type === 'fix') {
    changelogCategory = 'Fixed';
  } else {
    changelogCategory = 'Changed';
  }

  return { ...parsed, qualifies: true, bumpLevel, changelogCategory };
}

module.exports = { classifyCommit };
