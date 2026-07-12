#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const { parseCommit } = require('./parse-commit');
const { classifyCommit } = require('./classify-commit');
const { computeReleasePlan } = require('./compute-release-plan');
const { renderChangelogSection } = require('./render-changelog-section');

const REPO_ROOT = path.join(__dirname, '..', '..');
const ROOT_CHANGELOG_PATH = path.join(REPO_ROOT, 'CHANGELOG.md');
const BACKEND_PKG_PATH = path.join(REPO_ROOT, 'backend', 'package.json');
const FRONTEND_PKG_PATH = path.join(REPO_ROOT, 'frontend', 'package.json');
const UNIFIED_MARKER = '## Unified versioning';

const RECORD_SEP = '\x1f';
const ENTRY_SEP = '\x1e';

function git(args) {
  return execFileSync('git', args, { cwd: REPO_ROOT, encoding: 'utf8' });
}

function getLastReleaseTag() {
  try {
    return git(['describe', '--tags', '--abbrev=0', '--match', 'v*']).trim();
  } catch (err) {
    throw new Error(
      `No previous release tag found (expected at least v0.22.1 to exist from the Historia 1 migration): ${err.message}`
    );
  }
}

function getCommitsSinceTag(tag) {
  const format = `%H${RECORD_SEP}%s${RECORD_SEP}%b${ENTRY_SEP}`;
  const raw = git(['log', `${tag}..HEAD`, `--format=${format}`]);
  return raw
    .split(ENTRY_SEP)
    .map((entry) => entry.replace(/^\n+/, '').trim())
    .filter(Boolean)
    .map((entry) => {
      const [sha, subject, body] = entry.split(RECORD_SEP);
      return { sha, subject: subject || '', body: body || '' };
    });
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeJson(filePath, data) {
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`);
}

function insertChangelogSection(changelogContent, section) {
  const markerIndex = changelogContent.indexOf(UNIFIED_MARKER);
  if (markerIndex === -1) {
    throw new Error(`root CHANGELOG.md is missing the "${UNIFIED_MARKER}" marker`);
  }

  const afterMarker = changelogContent.indexOf('\n## ', markerIndex + UNIFIED_MARKER.length);
  const insertAt = afterMarker === -1 ? changelogContent.length : afterMarker;

  return (
    `${changelogContent.slice(0, insertAt).replace(/\n*$/, '\n\n')}${section.trim()}\n\n${changelogContent
      .slice(insertAt)
      .replace(/^\n+/, '')}`
  );
}

function main() {
  const backendPkg = readJson(BACKEND_PKG_PATH);
  const frontendPkg = readJson(FRONTEND_PKG_PATH);

  if (backendPkg.version !== frontendPkg.version) {
    console.error(
      `::error::Lockstep version mismatch: backend/package.json is ${backendPkg.version}, frontend/package.json is ${frontendPkg.version}`
    );
    process.exitCode = 1;
    return;
  }

  const previousVersion = backendPkg.version;
  const lastTag = getLastReleaseTag();
  const rawCommits = getCommitsSinceTag(lastTag);

  const classifiedCommits = rawCommits.map(({ sha, subject, body }) => {
    const parsed = parseCommit(subject, body);
    return { sha, ...classifyCommit(parsed) };
  });

  const date = new Date().toISOString().slice(0, 10);
  const plan = computeReleasePlan(classifiedCommits, previousVersion, date);

  for (const warning of plan.warnings) {
    console.log(`::warning::${warning}`);
  }

  if (plan.bumpLevel === 'none' || !plan.nextVersion) {
    console.log(`No qualifying commits since ${lastTag} — nothing to release.`);
    return;
  }

  backendPkg.version = plan.nextVersion;
  frontendPkg.version = plan.nextVersion;
  writeJson(BACKEND_PKG_PATH, backendPkg);
  writeJson(FRONTEND_PKG_PATH, frontendPkg);

  const section = renderChangelogSection(plan);
  const changelogContent = fs.readFileSync(ROOT_CHANGELOG_PATH, 'utf8');
  fs.writeFileSync(ROOT_CHANGELOG_PATH, insertChangelogSection(changelogContent, section));

  git(['add', 'CHANGELOG.md', 'backend/package.json', 'frontend/package.json']);
  git(['commit', '-m', `chore(release): v${plan.nextVersion} [skip ci]`]);
  git(['tag', '-a', `v${plan.nextVersion}`, '-m', `v${plan.nextVersion}`]);

  console.log(`Released v${plan.nextVersion} (${plan.bumpLevel} bump, ${plan.entries.length} entr${plan.entries.length === 1 ? 'y' : 'ies'}).`);
}

main();
