'use strict';

const CONVENTIONAL_COMMIT_PATTERN = /^([a-zA-Z]+)(?:\(([^)]+)\))?(!)?:\s*(.+)$/s;
const BREAKING_FOOTER_PATTERN = /BREAKING CHANGE:/;

/**
 * Parses a raw commit subject/body into its Conventional Commits parts.
 * @param {string} subject
 * @param {string} body
 * @returns {{type: string|null, scope: string|null, description: string, breaking: boolean, malformed: boolean}}
 */
function parseCommit(subject, body) {
  const match = CONVENTIONAL_COMMIT_PATTERN.exec(subject || '');

  if (!match) {
    return {
      type: null,
      scope: null,
      description: subject || '',
      breaking: false,
      malformed: true,
    };
  }

  const [, type, scope, bang, description] = match;
  const breaking = Boolean(bang) || BREAKING_FOOTER_PATTERN.test(body || '');

  return {
    type,
    scope: scope || null,
    description,
    breaking,
    malformed: false,
  };
}

module.exports = { parseCommit };
