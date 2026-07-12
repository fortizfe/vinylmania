'use strict';

const CATEGORY_ORDER = ['Added', 'Changed', 'Fixed', 'Removed'];

/**
 * Renders a ReleasePlan into a "## [X.Y.Z] - YYYY-MM-DD" Markdown block,
 * grouped by category in CATEGORY_ORDER, omitting empty categories.
 * @param {object} releasePlan
 */
function renderChangelogSection(releasePlan) {
  if (!releasePlan.nextVersion || releasePlan.bumpLevel === 'none') {
    return '';
  }

  const lines = [`## [${releasePlan.nextVersion}] - ${releasePlan.date}`, ''];

  for (const category of CATEGORY_ORDER) {
    const entries = releasePlan.entries.filter((entry) => entry.category === category);
    if (entries.length === 0) continue;

    lines.push(`### ${category}`, '');
    for (const entry of entries) {
      const suffix = entry.commitSha ? ` ([${entry.commitSha}])` : '';
      lines.push(`- ${entry.description}${suffix}`);
    }
    lines.push('');
  }

  return lines.join('\n').replace(/\n+$/, '\n');
}

module.exports = { renderChangelogSection };
