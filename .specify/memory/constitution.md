<!--
Sync Impact Report
Version change: 2.2.0 → 2.3.0
Modified principles: none (existing principles I-VII unchanged)
Added sections: none
Changed sections:
  - Development Workflow (Quality Gates): the two "CHANGELOG.md" bullets
    (mandatory per-package changelog entry + matching package.json version
    bump on every backend/frontend PR) were replaced with a single rule
    prohibiting manual changelog/version maintenance — changelog generation
    and semantic version bumps are now handled by the GitHub Actions
    pipeline from Conventional Commit history instead of by developers in
    each PR. Reviewers MUST NOT reject PRs for missing a manual entry/bump,
    and MUST NOT accept hand-written CHANGELOG.md/package.json version
    edits. Rationale updated to reflect automation replacing manual upkeep.
Removed sections: none (rule replaced in place, not deleted outright)
Templates requiring updates:
  ✅ .specify/templates/plan-template.md (no changelog-specific references; no change needed)
  ✅ .specify/templates/spec-template.md (no changelog-specific references; no change needed)
  ✅ .specify/templates/tasks-template.md (no changelog-specific references; no change needed)
  ✅ .specify/templates/checklist-template.md (generic checklist template; no conflicting gate)
  ⚠  No command files found under .specify/templates/commands/ — nothing to update
Follow-up TODOs: none
-->

# Vinylmania Constitution

Vinylmania is a modern web integration for vinyl record collectors built around three
pillars: (1) Discogs-sourced catalog metadata as the source of truth for releases,
(2) collector-facing music ratings on those releases, and (3) related music news
aggregated from external sources. The product's editorial and curation lens is rock
and metal — default news sources, genre filters, and content emphasis favor rock/metal
— without technically restricting the catalog, search, or ratings to those genres.

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

### II. Discogs Integration-First & Modularity
Every feature touching catalog metadata MUST integrate with the Discogs API as the
primary source of truth and MUST optimize Discogs usage through reusable, independently
testable modules (service/client/cache layers with clear contracts). Metadata that
Discogs can provide MUST NOT be manually curated as an alternate catalog source.
Integration modules MUST implement rate-limit-aware behavior, explicit error handling,
and cache/normalization strategies that reduce redundant Discogs requests.
**Rationale**: Vinylmania's core value is leveraging Discogs data quality at scale;
making Discogs integration explicit and modular preserves correctness, performance, and
maintainability as collectors' libraries grow.

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

### VII. Curated Ratings & Music News (Rock/Metal Focus)
Every release accessible in Vinylmania MUST support a collector-facing rating (a
numeric score with a clearly defined scale and color-banded severity, e.g. low/medium/
high) that is treated as user-specific state under Principle II's Firebase constraints,
not as Discogs catalog data. The application MUST also surface related music news
aggregated from external RSS/news sources; each aggregated item MUST preserve
attribution (source name, publish date, link to the original article) and MUST open
the original source rather than reproducing full article content. News/ratings
features MUST degrade gracefully per-source: if one external feed or rating lookup
fails or times out, the rest of the page MUST still render with the available data
rather than failing as a whole. Rock and metal MUST be the default editorial focus for
curated news sources and content emphasis; this is a curation default, not a technical
restriction — the catalog, search, and rating features MUST NOT hard-exclude other
genres.
**Rationale**: Ratings and news are core to Vinylmania's value proposition alongside
Discogs metadata, not optional add-ons; treating them as first-class principles keeps
their data boundaries (user-state vs. external content vs. Discogs catalog) and
resilience expectations explicit as the app adds more feeds and rating surfaces. A
rock/metal default reflects the project's actual focus (see existing news sources like
Metal Injection and Metal Storm) while keeping the door open to other genres.

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
  become an independent source of truth for catalog data. Discogs integration MUST
  minimize redundant requests via cache reuse and normalized metadata handling.
  Discogs API rate limits and outages MUST be handled gracefully (Principle V,
  Observability) rather than silently failing.
- **News/RSS Data Source**: Related music news MUST be aggregated from external
  RSS/news feeds (e.g., Metal Injection, Metal Storm) rather than hand-authored or
  hosted as original editorial content. Each feed source is independent and MUST be
  handled per Principle VII (Curated Ratings & Music News): an unreachable or
  malformed feed MUST be skipped with a subtle notice rather than failing the whole
  news surface. New feed sources SHOULD favor rock/metal publications consistent
  with the project's default editorial focus, but MAY include other genres.
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
- **Dual responsive layout (desktop & mobile)**: Every screen MUST implement
  two purpose-built layout states, not a single layout that merely reflows: a
  desktop/wide-viewport layout that makes deliberate use of the available
  horizontal space (e.g., multi-column grids, side-by-side panels, sidebars)
  rather than a narrow single-column layout stretched to fill the viewport;
  and a mobile-viewport layout specifically adapted for small, touch-first
  screens (typically single-column, compact spacing, no horizontal scrolling
  of primary content). Both layouts MUST be implemented with Tailwind's
  responsive breakpoint utilities (`sm:`, `md:`, `lg:`, `xl:`), not a
  separate device-detection mechanism.
- **Minimum touch target size (44×44 CSS px)**: Every interactive control
  (buttons, links acting as buttons, filter chips, form inputs, icon buttons,
  etc.) MUST meet a minimum touch target size of 44×44 CSS pixels at mobile
  viewport widths, per WCAG 2.5.5 (Level AAA) and the Apple Human Interface
  Guidelines baseline. This MUST be satisfied using Tailwind's default
  spacing scale (e.g., `min-h-11 min-w-11`, already 2.75rem/44px) rather than
  an arbitrary value, consistent with the "No custom CSS without
  justification" rule below.
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
technical debt from deprecated v3 utility names. Requiring a purpose-built
desktop layout (rather than a stretched mobile layout) keeps information-dense
screens (search results, library, news) usable on wide monitors instead of
wasting horizontal space; requiring a dedicated mobile layout with a 44×44px
touch-target floor keeps every screen comfortably usable and accessible on
phones, not merely "not broken."

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
- Any pull request that changes code under `/frontend` MUST include end-to-end
  (e2e) coverage for the affected user flow under `/e2e` (Playwright). Execution
  of the full e2e suite is required as part of the deployment pipeline quality
  gates, not as a mandatory step in each local development iteration. Reviewers
  MUST reject frontend PRs that remove required e2e coverage or leave pipeline
  e2e checks failing.
**Rationale**: Component and unit tests validate isolated logic, but Vinylmania's
frontend risk lives in cross-cutting flows (auth, search, navigation, collection
management) that only fail when real user journeys are exercised end-to-end.
Keeping e2e mandatory at pipeline level preserves release confidence without
forcing every local development cycle to run the full suite.
- Developers MUST NOT manually maintain `backend/CHANGELOG.md` or
  `frontend/CHANGELOG.md`, and MUST NOT manually bump the `version` field in
  either package's `package.json` as part of a PR. Changelog generation and
  semantic version bumps for both packages are handled automatically by the
  GitHub Actions pipeline, driven by Conventional Commit messages (see the
  commit message rule above and Principle VI's classification). Reviewers
  MUST NOT reject a PR for missing a changelog entry or a manual version
  bump; a PR MUST NOT include hand-written changes to either `CHANGELOG.md`
  file or a hand-edited `version` field.
**Rationale**: Manually keeping per-package changelogs and version bumps in
sync with every PR was a recurring source of drift, merge conflicts, and
forgotten steps. Deriving both from Conventional Commit history in the CI/CD
pipeline (Principle III: Simplicity, YAGNI & KISS) removes duplicated
developer effort while keeping the same Conventional Commits input and the
same Principle VI classification as the source of truth.

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

**Version**: 2.3.0 | **Ratified**: 2026-07-03 | **Last Amended**: 2026-07-12
