# Quickstart: Validating Changelog & Semantic Versioning Setup

## Prerequisites

- Repository checked out locally at `/Users/fortizfe/Repositories/vinylmania`.
- No build or server startup required — this feature is documentation + metadata only.

## Validation Scenarios

### 1. Both changelogs exist and are independently structured (User Story 1)

```bash
test -f frontend/CHANGELOG.md && echo "frontend changelog: OK"
test -f backend/CHANGELOG.md && echo "backend changelog: OK"
grep -n "^## \[Unreleased\]" frontend/CHANGELOG.md
grep -n "^## \[Unreleased\]" backend/CHANGELOG.md
```

**Expected outcome**: Both commands print `OK`, and each `CHANGELOG.md` has exactly
one `## [Unreleased]` heading near the top, above any dated version sections.

### 2. Each package exposes an independent SemVer version (User Story 2)

```bash
node -p "require('./frontend/package.json').version"
node -p "require('./backend/package.json').version"
```

**Expected outcome**: Both print a `MAJOR.MINOR.PATCH` value (e.g., `1.0.0`); the two
values are allowed to be equal by coincidence but are not derived from one another.

### 3. Every released version has a matching changelog section (User Story 2 / FR-009)

```bash
FRONTEND_VERSION=$(node -p "require('./frontend/package.json').version")
BACKEND_VERSION=$(node -p "require('./backend/package.json').version")
grep -n "^## \[$FRONTEND_VERSION\]" frontend/CHANGELOG.md
grep -n "^## \[$BACKEND_VERSION\]" backend/CHANGELOG.md
```

**Expected outcome**: Each `grep` finds exactly one matching `## [version] - date`
heading in the corresponding package's changelog.

### 4. Backfilled history covers already-delivered feature areas (User Story 3)

```bash
grep -Ei "login|sign-in|navigation|search|e2e|tailwind" frontend/CHANGELOG.md
grep -Ei "discogs|vinyl|deploy" backend/CHANGELOG.md
```

**Expected outcome**: Each package's changelog mentions the feature areas already
delivered in that package (see [research.md](research.md) "Source material for
backfill content" for the authoritative mapping of spec directories to package).

### 5. Structure matches Keep a Changelog categorization

```bash
grep -n "^### " frontend/CHANGELOG.md backend/CHANGELOG.md
```

**Expected outcome**: Every subsection heading found is one of `Added`, `Changed`,
`Fixed`, `Removed` (per [data-model.md](data-model.md)).

## Out of Scope for This Validation

- No automated test suite is added by this feature (Technical Context: N/A testing) —
  the checks above are manual/CLI validation, not a new CI job.
- No changelog-generation tooling is validated here (explicitly out of scope per the
  spec's Assumptions).
