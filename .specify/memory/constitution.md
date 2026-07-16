<!--
Sync Impact Report
Version change: 2.5.0 → 2.6.0
Modified principles: none (existing principles I-VIII unchanged)
Added sections:
  - New Core Principle IX: "Frontend Network Requests — Backend-Only".
    Requires that all JS-initiated frontend requests (fetch/XHR/WebSocket/
    third-party SDK) target the Vinylmania backend exclusively, and that no
    third-party SDK (Firebase, Discogs, or future equivalents) be used from
    `frontend/` to make data requests. Explicitly carves out two cases from
    its scope: (1) a full-page navigation to an external identity/OAuth
    provider's authorization page is not a "request" under this principle,
    since it is inevitable in any redirect-based OAuth flow and outside the
    app's own JS code's control; (2) static resource loading via native
    HTML attributes (`<img src>`, `<link>`) is out of scope, since the
    principle governs data/API requests initiated by JS, not passive
    resource loading. Explicitly exempts `e2e/` test doubles, which exist
    to simulate the external third parties this principle restricts
    production code from calling directly. Governs `frontend/` only; does
    not restate, contradict, or narrow Principle VIII (backend-only) or
    Principle II (Discogs integration, which already assumes the
    integration lives in `backend/` without saying so explicitly).
Changed sections: none
Removed sections: none
Templates requiring updates:
  ✅ .specify/templates/plan-template.md (Constitution Check is a generic
     "[Gates determined based on constitution file]" placeholder re-evaluated
     per feature against whatever principles exist; no principle — including
     I-VIII — is hardcoded into it, so Principle IX needs no template change)
  ✅ .specify/templates/spec-template.md (no network-origin-specific section
     exists for any principle; no change needed)
  ✅ .specify/templates/tasks-template.md (no network-origin-specific
     references; no change needed)
  ✅ .specify/templates/checklist-template.md (generic checklist template; no
     conflicting gate)
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

### VIII. Hexagonal Architecture (Ports & Adapters) — Backend
All `backend/` code MUST be organized into four layers: **Domain** (business rules,
entities, and domain-specific errors, with no knowledge of HTTP or any SDK), **Application**
(use cases that orchestrate domain logic and ports, with no knowledge of concrete
infrastructure), **Ports** (interfaces that declare an infrastructure contract without
implementing it), and **Adapters** (concrete implementations of a port, or translators
between an external protocol and the application layer). Domain and Application code
MUST NOT import infrastructure SDKs directly (`firebase-admin`, `axios`, `ioredis`,
`rss-parser`, or any equivalent future SDK) — only Adapters MAY import them. Express
routes and Express middleware (e.g. authentication middleware) are both **driving**
adapters: their sole responsibility is translating an HTTP request into an application
use-case invocation (or, for middleware, into a port call that enriches the request)
and translating the result — or a thrown domain error — back into an HTTP response or
the next middleware step; neither routes nor middleware MUST contain business
orchestration logic, and neither MUST import an infrastructure SDK directly — they MUST
depend on a port instead. The four layers MUST live under global, backend-wide folders —
`backend/src/domain/`, `backend/src/application/`, `backend/src/ports/`, and
`backend/src/adapters/` — each containing one subfolder per business domain (e.g.
`backend/src/domain/library/`, `backend/src/adapters/library/`). Modules with no
infrastructure dependency (e.g. the logger, or pure algorithmic utilities such as a
concurrency helper) are transversal: they already satisfy the dependency rule as
written and MAY be consumed from any layer without a dedicated "shared kernel"
exception or a port. This principle governs `backend/` only; it does not apply to
`frontend/` or `e2e/`, which are governed by their own principles and stack rules
elsewhere in this document.
**Rationale**: A backend where business rules import infrastructure SDKs directly
cannot be unit-tested without real Firestore/Discogs/Redis/RSS access, and cannot swap
an implementation (e.g. a cache backend) without touching domain code — both violate
Principle I (Test-First) and Principle IV (SOLID's Dependency Inversion) in practice,
even though nothing today enforces it explicitly. The project already has a working,
conformant example of this separation for error handling: the `DiscogsError` hierarchy
(with a typed `code`: `not_found`/`rate_limited`/`unavailable`/`validation_error`/
`auth_failed`) and sibling errors like `DiscogsNotLinkedError`, `FieldNotEditableError`,
and `DiscogsOauthFlowError` are thrown by domain logic with no knowledge of HTTP, while
only the routes (via functions such as `respondCollectionError`/`handleFailure`)
translate them into status codes. This principle codifies that existing pattern as the
mandatory model for every backend domain, rather than inventing a new error-handling
mechanism, so that future backend work — migrated or new — is consistent by default
instead of by convention alone.

### IX. Frontend Network Requests — Backend-Only
All code under `frontend/` that initiates a network request via JavaScript (`fetch`,
`XMLHttpRequest`, `WebSocket`, or any SDK) MUST direct that request exclusively to
Vinylmania's own backend. No SDK belonging to an external provider (Firebase, Discogs,
or any future equivalent) MUST be used from `frontend/` to make data requests — that
provider's integration MUST live in `backend/` instead, consistent with Principle VIII.
A full-page navigation (`window.location`, `<a href>`) to an external identity or OAuth
provider's authorization page is explicitly NOT a "request" in the sense of this
principle: it is an unavoidable step of any redirect-based OAuth flow and is outside the
control of the application's own JS code, so this principle MUST NOT be read as
prohibiting the login/account-link mechanism itself. Loading static resources via native
HTML attributes not initiated by JS (e.g. `<img src>` pointing at an external CDN, or a
`<link>` to an external font) is out of scope of this principle, which governs
data/API requests initiated by JavaScript, not passive resource loading. This principle
governs `frontend/` only; it does not restate, contradict, or narrow Principle VIII
(which already governs `backend/`) or Principle II (Discogs integration, which already
assumes the integration lives in `backend/` without saying so explicitly). `e2e/` test
doubles that stand in for these external providers (e.g. an OAuth provider stub) are
exempt from this principle, since their entire purpose is to simulate the external third
parties this principle restricts production frontend code from calling directly.
**Rationale**: A frontend that talks directly to third-party services (an identity
provider's SDK, a catalog API) duplicates integration logic the backend already owns,
scatters credentials and rate-limit handling across two codebases, and makes it
impossible to enforce Principle II's Discogs-integration rules or Principle VIII's
hexagonal-architecture rules uniformly — both principles already assume backend-only
external integration without saying so explicitly, and this principle closes that gap.
The OAuth-redirect and static-resource carve-outs exist because a literal reading of
"no requests but the backend" would otherwise appear to forbid the project's own
established, backend-mediated login/account-link pattern (a full-page redirect, never a
popup or SDK call) and the routine loading of cover art and brand typography — neither
of which the audit that produced this principle found to be a violation in practice.

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
  (`bg-stone-200`/`dark:bg-surface-raised`, `animate-pulse`, `rounded-md`)
  that mirrors the exact shape and dimensions of the final content (same
  card structure, same approximate number of lines/blocks). Generic spinners
  and blank screens MUST NOT be used as the default loading state.
- **Visual lightness & brand personality**: Layouts MUST use the spacing
  scale generously (`gap-4`, `space-y-4`, `p-6`); typography MUST rely on
  `font-medium`/`font-semibold` for hierarchy rather than heavy bold
  weights, except page headers, dashboard/landing section ("pillar")
  headers, and single-record showcase titles, which MUST use the brand's
  display typeface (`--font-display`, Anton) per the layout-shift rule
  below — never body text, labels, data values, or repeated per-item titles
  in dense lists/grids; the color palette MUST stay defined in `@theme` and
  MUST use the warm-neutral (`stone`) family — not cool `gray`/`slate` —
  for backgrounds, text, and borders, plus at least two brand accents
  (`--color-primary` indigo as the primary-action color everywhere, and
  `--color-accent` amber for secondary emphasis: highlights, badges, hover
  accents, decorative brand moments) rather than a single reduced accent;
  shadows MUST stay soft (`shadow-sm`/`shadow-md`) for in-flow cards,
  reserving `shadow-lg`/`shadow-xl`/`shadow-2xl` for floating elements such
  as modals.
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
  skeletons, MUST support dark mode. Dark mode's primary and elevated
  surfaces MUST use the brand's near-black tokens (`--color-surface`,
  `--color-surface-raised`) rather than a generic `gray-950`/`gray-900`.
  Headings using `--font-display` MUST pair a fixed `text-*`/`leading-*`
  utility so font-swap reflow never changes line-box height (no cumulative
  layout shift), consistent with the "No layout shift" rule above applied to
  font loading instead of async data.
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

**Version**: 2.6.0 | **Ratified**: 2026-07-03 | **Last Amended**: 2026-07-16
