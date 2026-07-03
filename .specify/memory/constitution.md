<!--
Sync Impact Report
Version change: 1.1.0 → 1.2.0
Modified principles: none (existing principles unchanged)
Added sections:
  - Technology Stack: added source control (GitHub) and deployment (Vercel) requirements
Removed sections: none
Templates requiring updates:
  ✅ .specify/templates/plan-template.md (Technical Context / Target Platform fields will be
     filled with GitHub + Vercel going forward — no template edit needed)
  ✅ .specify/templates/spec-template.md (no stack-specific references found)
  ✅ .specify/templates/tasks-template.md (no stack-specific references found)
  ✅ .specify/templates/checklist-template.md (no stack-specific references found)
  ⚠  No command files found under .specify/templates/commands/ — nothing to update
Follow-up TODOs: none
-->

# Vynilmania Constitution

Vynilmania is a web application for vinyl record collectors, focused on managing and
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
- **Backend**: Express.js (Node.js) is the required framework for all server-side
  API code.
- **Database**: Firebase (Firestore/Realtime Database) is the required data store.
  Given Firebase's schemaless nature, Principle VI (Versioning & Breaking Changes)
  still applies: changes to document shape or field semantics that break existing
  readers/writers are MAJOR changes and MUST include a documented migration/backfill
  plan.
- **Source control**: The canonical code repository MUST be hosted on GitHub. All
  branches, pull requests, and code review MUST go through GitHub.
- **Deployment**: Vercel is the required deployment platform for the application.
  Deployments SHOULD be triggered from GitHub (e.g., via GitHub integration/CI) so
  that the deployed state always traces back to a reviewed commit on GitHub.
- Deviating from this stack (a different frontend framework, backend framework,
  database, source control host, or deployment platform) MUST be justified in
  writing and treated as a Complexity Tracking item per the Development Workflow
  gates below.
**Rationale**: Locking the stack keeps a solo/small-team project consistent and
avoids fragmenting effort across competing frameworks; it also determines what
"Test-First" and "Observability" look like in practice (e.g., Jest/RTL for React,
Firebase emulator for integration tests).

## Development Workflow (Quality Gates)

- Every pull request MUST verify compliance with these principles before merge;
  reviewers MUST reject PRs that introduce untested behavior, unjustified
  complexity, or undocumented breaking changes.
- Any deviation from a principle MUST be documented with rationale in the PR
  description (what, why, simpler alternative considered and rejected).
- Complexity that violates Principle III or IV MUST be justified in writing; if it
  cannot be justified, the PR MUST be simplified before merge.

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

**Version**: 1.2.0 | **Ratified**: 2026-07-03 | **Last Amended**: 2026-07-03
