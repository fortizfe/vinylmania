<!--
Sync Impact Report
Version change: 1.6.0 → 1.7.0
Modified principles: none (existing principles unchanged)
Added sections:
  - New quality gate under "Development Workflow (Quality Gates)" requiring
    every development touching /backend or /frontend to keep that package's
    CHANGELOG.md (backend/CHANGELOG.md, frontend/CHANGELOG.md) up to date in
    the same PR, following Keep a Changelog categorization aligned with
    Principle VI's semantic version classification; reviewers MUST reject
    PRs missing the matching changelog entry.
Removed sections: none
Templates requiring updates:
  ✅ .specify/templates/plan-template.md (no CHANGELOG-specific gate references found; no change needed)
  ✅ .specify/templates/spec-template.md (no CHANGELOG-specific gate references found; no change needed)
  ✅ .specify/templates/tasks-template.md (no CHANGELOG-specific gate references found; no change needed)
  ✅ .specify/templates/checklist-template.md (no CHANGELOG-specific gate references found; no change needed)
  ⚠  No command files found under .specify/templates/commands/ — nothing to update
Follow-up TODOs:
  - backend/CHANGELOG.md and frontend/CHANGELOG.md do not yet exist in the
    repo; the next PR touching either package MUST create it (Keep a
    Changelog format) alongside its first entry.
-->

# Vinylmania Constitution

Vinylmania is a web application for vinyl record collectors, focused on managing and
organizing a personal vinyl library.

## Core Principles

### I. Test-First (NON-NEGOTIABLE)
Tests MUST be written before implementation and MUST be approved by the developer (or
reviewer) before code is written to satisfy them. The Red-Green-Refactor cycle is
mandatory: a failing test comes first, then the minimal code to pass it, then
refactoring. No feature or bug fix MAY be merged without an accompanying test that
would have failed without the change.
**Rationale**: A library-management app lives or dies on data correctness (collections,
tracklists, ownership state). Writing tests first forces requirements to be explicit
before code exists, and prevents regressions in core cataloging logic.

### II. Library-First & Modularity
Every feature MUST be built as a self-contained, independently testable module (a
library, service, or component) with a clear, single-purpose responsibility. Modules
MUST expose a well-defined interface (API, CLI, or component contract) rather than
relying on shared mutable state or implicit coupling. No module MAY exist purely for
organizational convenience — each MUST have a clear, documented purpose.
**Rationale**: Independent modules can be tested, versioned, and reasoned about in
isolation, which keeps the codebase navigable as the catalog domain (records, artists,
collections, marketplace features) grows.

### III. Simplicity, YAGNI & KISS
Start with the simplest design that satisfies the current, stated requirement. Do not
build abstractions, configuration options, or extensibility points for hypothetical
future needs. Prefer straightforward, readable code over clever solutions. If a
simpler alternative exists that meets the same requirement, it MUST be used unless a
documented reason justifies added complexity.
**Rationale**: Premature abstraction is a recurring cost sink; a small, well-scoped
app benefits far more from clarity than from speculative flexibility.

### IV. SOLID Design
Code MUST follow SOLID design principles: Single Responsibility, Open/Closed,
Liskov Substitution, Interface Segregation, and Dependency Inversion. Classes and
modules MUST have one reason to change; new behavior SHOULD be added via extension
rather than modification of stable, tested code; abstractions MUST NOT leak
implementation details that callers do not need.
**Rationale**: SOLID principles keep the codebase extensible without violating
Principle III — they guide *how* to structure code that must change over time,
while YAGNI/KISS guide *when* to introduce that structure at all.

### V. Observability
All services and components MUST emit structured logs for key operations (record
added/removed, sync events, errors) sufficient to diagnose issues in production
without attaching a debugger. Errors MUST be logged with enough context (operation,
identifiers, cause) to be actionable. Text-based, greppable log output is preferred
over opaque binary or purely visual-only diagnostics.
**Rationale**: A hosted web app needs production visibility; structured logs are the
cheapest and most durable way to achieve it.

### VI. Versioning & Breaking Changes
The project MUST follow semantic versioning (MAJOR.MINOR.PATCH). Any change that
breaks an existing API contract, data schema, or stored-data compatibility is a
MAJOR change and MUST include a documented migration path. New backward-compatible
functionality is MINOR. Fixes and clarifications are PATCH. Breaking changes MUST be
called out explicitly in the change description before merge.
**Rationale**: Collectors' data (their vinyl libraries) is the core asset of this
app; uncommunicated breaking changes to schemas or contracts risk data loss or
corruption.

## Additional Constraints (Web Application Standards)

- The application MUST be delivered as a web application; any API MUST be documented
  with request/response contracts before implementation begins (see Principle I).
- Data persistence layers (whatever storage is chosen) MUST support migrations —
  schema changes MUST NOT be applied directly against production without a
  reversible migration script.
- User-facing errors MUST be distinguished from internal/system errors; internal
  error details MUST NOT leak to end users but MUST be available in logs
  (Principle V).

## Technology Stack

- **Frontend**: React with TypeScript is the required stack for all UI code. New
  frontend code MUST NOT be written in plain JavaScript; existing plain-JS code
  MUST be migrated to TypeScript before material extension.
- **Styling**: Tailwind CSS v4 is the required styling solution for all UI code.
  See "UI Design System & Styling (Tailwind CSS v4)" below for the governing
  rules on configuration, components, loading states, and theming.
- **Backend**: Express.js (Node.js) is the required framework for all server-side
  API code.
- **Database**: Firebase (Firestore/Realtime Database) is the required data store.
  Given Firebase's schemaless nature, Principle VI (Versioning & Breaking Changes)
  still applies: changes to document shape or field semantics that break existing
  readers/writers are MAJOR changes and MUST include a documented migration/backfill
  plan.
- **Vinyl Data Source**: All vinyl/release metadata (artist, title, tracklist,
  format, year, label, cover art, etc.) MUST be sourced from the
  [Discogs REST API](https://www.discogs.com/developers). The application MUST NOT
  hand-author or hardcode catalog metadata that Discogs can provide. Firebase MUST
  be used only for user-specific state (collection membership, ownership, personal
  notes, ratings) and MAY cache Discogs responses for performance, but MUST NOT
  become an independent source of truth for catalog data. Discogs API rate limits
  and outages MUST be handled gracefully (Principle V, Observability) rather than
  silently failing.
- **Source control**: The canonical code repository MUST be hosted on GitHub. All
  branches, pull requests, and code review MUST go through GitHub.
- **Deployment**: Vercel is the required deployment platform for the application.
  Deployments SHOULD be triggered from GitHub (e.g., via GitHub integration/CI) so
  that the deployed state always traces back to a reviewed commit on GitHub.
- Deviating from this stack (a different frontend framework, backend framework,
  database, vinyl data source, source control host, or deployment platform) MUST be
  justified in writing and treated as a Complexity Tracking item per the
  Development Workflow gates below.
**Rationale**: Locking the stack keeps a solo/small-team project consistent and
avoids fragmenting effort across competing frameworks; it also determines what
"Test-First" and "Observability" look like in practice (e.g., Jest/RTL for React,
Firebase emulator for integration tests).

## UI Design System & Styling (Tailwind CSS v4)

- **CSS-first configuration**: Tailwind configuration MUST live in the main CSS
  entry file via `@import "tailwindcss"` and an `@theme` block (colors, fonts,
  and spacing exposed as `--color-*`, `--font-*`, `--spacing-*` variables). A
  `tailwind.config.js` file MUST NOT be created or depended upon unless
  strictly required for a plugin that has no CSS-first equivalent.
- **Card-based layout**: Primary content blocks MUST be presented as "card"
  components using Tailwind v4 utilities (`rounded-xl`, `border`,
  `shadow-sm`/`shadow-md` from the v4 named shadow scale, and consistent
  padding — `p-4` or `p-6`). A reusable `<Card>` component MUST centralize
  these classes; the card-pattern utility string MUST NOT be repeated inline
  across screens.
- **Reusable atomic components**: All UI MUST be composed from a shared set of
  atomic, reusable components (`Card`, `Button`, `Badge`, `Avatar`, `Input`,
  etc.) that encapsulate their Tailwind classes. Any utility-class combination
  that defines a visual pattern MUST NOT be hand-repeated across files; once it
  appears twice or more, it MUST be extracted into a component or a utility
  function (e.g., `clsx`, `tailwind-variants`).
- **Skeleton loading states**: Any content that depends on an asynchronous
  request MUST show a skeleton loader built with Tailwind utilities
  (`bg-gray-200`/`dark:bg-gray-800`, `animate-pulse`, `rounded-md`) that
  mirrors the exact shape and dimensions of the final content (same card
  structure, same approximate number of lines/blocks). Generic spinners and
  blank screens MUST NOT be used as the default loading state.
- **Visual lightness**: Layouts MUST use the spacing scale generously (`gap-4`,
  `space-y-4`, `p-6`); typography MUST rely on `font-medium`/`font-semibold`
  for hierarchy rather than heavy bold weights; the color palette MUST stay
  reduced and defined in `@theme` (neutrals such as gray/slate plus one accent
  via `--color-primary`); and shadows MUST stay soft (`shadow-sm`), reserving
  `shadow-xl`/`shadow-2xl` for floating elements such as modals.
- **No layout shift**: All states of a given component (skeleton, empty,
  error, populated) MUST share the same sizing classes (`w-*`, `h-*`,
  `min-h-*`) so that transitioning between states never causes layout shift.
- **Theme-variable dark mode**: Dark mode MUST be implemented with Tailwind's
  `dark:` prefix, combined with CSS variables in the `@theme` block so colors
  respond without duplicating utility variants. Every component, including
  skeletons, MUST support dark mode.
- **v4-current utility naming**: Only current Tailwind v4 utility names MUST
  be used (e.g., `bg-linear-*` instead of the deprecated `bg-gradient-to-*`,
  and explicit-suffix shadow/radius/blur scales). Deprecated v3-era class
  names MUST NOT be introduced.
- **No custom CSS without justification**: Tailwind utilities MUST be
  preferred over custom CSS files or styled-components. A value outside the
  default scale MUST be added as a variable inside the `@theme` block in the
  main CSS file rather than written as ad-hoc CSS; any exception MUST be
  documented with a rationale.
**Rationale**: These rules keep Vinylmania's UI consistent, lightweight, and
maintainable as the catalog and library screens grow. Centralizing visual
patterns in atomic components and CSS-first theme variables prevents drift
between screens; skeleton-first loading avoids jarring blank/spinner states on
a data-heavy collection app; and adherence to Tailwind v4's current API avoids
technical debt from deprecated v3 utility names.

## Development Workflow (Quality Gates)

- Every pull request MUST verify compliance with these principles before merge;
  reviewers MUST reject PRs that introduce untested behavior, unjustified
  complexity, or undocumented breaking changes.
- Any deviation from a principle MUST be documented with rationale in the PR
  description (what, why, simpler alternative considered and rejected).
- Complexity that violates Principle III or IV MUST be justified in writing; if it
  cannot be justified, the PR MUST be simplified before merge.
- All commit messages MUST follow the [Conventional Commits](https://www.conventionalcommits.org)
  specification: `<type>[optional scope]: <description>` (e.g., `feat:`, `fix:`,
  `docs:`, `refactor:`, `test:`, `chore:`). Breaking changes MUST be flagged with a
  `!` after the type/scope or a `BREAKING CHANGE:` footer, consistent with
  Principle VI (Versioning & Breaking Changes). Reviewers MUST reject PRs containing
  commits that do not comply.
**Rationale**: A consistent commit format makes history greppable, enables automated
changelog/version generation, and gives every commit a machine-readable link to
Principle VI's versioning policy (feat → MINOR, fix → PATCH, `!`/BREAKING CHANGE → MAJOR).
- Any pull request that changes code under `/frontend` MUST be accompanied by
  passing end-to-end (e2e) test coverage for the affected user flow, added or
  updated under `/e2e` (Playwright) before the feature is considered complete.
  A frontend PR MUST NOT be merged solely on unit/component test coverage
  (Principle I still applies for those) — the e2e suite MUST be run and pass
  against the changed flow, and reviewers MUST reject frontend PRs that lack
  corresponding e2e coverage or that leave the e2e suite failing.
**Rationale**: Component and unit tests validate isolated logic, but Vinylmania's
frontend risk lives in cross-cutting flows (auth, search, navigation, collection
management) that only fail when real user journeys are exercised end-to-end;
requiring e2e coverage at the close of frontend work catches integration
regressions that unit tests structurally cannot.
- Every development MUST keep a `CHANGELOG.md` up to date in each package it
  touches: `backend/CHANGELOG.md` for `/backend` changes and
  `frontend/CHANGELOG.md` for `/frontend` changes. Any PR that modifies code
  under one of these directories MUST include a corresponding entry in that
  package's `CHANGELOG.md` describing the change (following the
  [Keep a Changelog](https://keepachangelog.com) `Added`/`Changed`/`Fixed`/
  `Removed` categorization and aligned with Principle VI's semantic version
  classification). Reviewers MUST reject PRs that change `/backend` or
  `/frontend` code without a matching changelog entry.
**Rationale**: A per-package changelog gives collectors, contributors, and
reviewers a human-readable history of what shipped in each deployable unit,
independent of git log archaeology, and keeps the changelog entry — not an
afterthought — tied to the same PR that introduces the change it describes.

## Governance

This constitution supersedes all other informal practices and conventions. Amendments
require: (1) a documented rationale for the change, (2) a version bump following the
semantic versioning policy below, and (3) propagation of the change into any
dependent templates or workflow docs in the same amendment.

**Versioning policy for this document**:
- MAJOR: Backward-incompatible governance changes, or removal/redefinition of an
  existing principle.
- MINOR: A new principle or materially expanded section is added.
- PATCH: Clarifications, wording, or typo fixes with no semantic change.

All future PRs and reviews MUST verify compliance with this constitution. Complexity
introduced against these principles MUST be justified in the PR description. Use
this document as the source of truth for runtime development guidance until a
project-specific guidance file is established.

**Version**: 1.7.0 | **Ratified**: 2026-07-03 | **Last Amended**: 2026-07-04
