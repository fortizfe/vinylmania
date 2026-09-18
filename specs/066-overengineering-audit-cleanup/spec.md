# Feature Specification: Over-engineering Audit Cleanup

**Feature Branch**: `066-overengineering-audit-cleanup`

**Created**: 2026-09-18

**Status**: Draft

**Input**: User description: "Crea un plan para corregir los resultados de la auditoria realizada en el mensaje anterior. Usa la respuesta de la auditoría como texto de entrada para este comando specify" — the input is the repo-wide over-engineering audit (ponytail-audit, 2026-09-18), whose ranked findings were:

1. `native:` independent two-column detail layout computed by script → CSS-only column wrappers (DOM/focus-order caveat)
2. `native:` hand-rolled overlay focus trap / focus restore / Escape handling → the platform's built-in modal dialog
3. `shrink:` duplicated URL-filter parsing between the library and search pages → one shared helper
4. `stdlib:` hand-rolled reduced-motion preference hook → the equivalent already shipped by the installed animation library
5. `delete:` test-environment variable setter dependency → the test runner already sets it
6. `native:` environment-file loader dependency (backend + e2e) → the runtime's built-in env-file loading
7. `yagni:` cache adapter functions that only delegate → assign the underlying functions directly
8. `delete:` unused `ready` value returned by the column-layout hook
9. `native:` HTTP client dependency → built-in fetch (no line savings)
10. `delete:` ~40 symbols exported but only used in their own file

## Clarifications

### Session 2026-09-18

- Q: Audit finding 9 (HTTP client → built-in fetch) — defer, add as P5, or split into a follow-up spec? → A: Keep deferred and out of scope; no follow-up spec is created now.
- Q: How is overlay behavior parity (SC-004) verified? → A: New end-to-end tests per overlay type (focus containment, Escape + focus return, background inertness), written and passing against the current code before the refactor and run on all configured browser engines, plus one manual screen-reader pass. *(Superseded during planning: finding 2 moved out of scope — see research.md R2 — so no overlay refactor or new overlay tests remain.)*

## User Scenarios & Testing *(mandatory)*

The "users" of this feature are twofold: **collectors** using Vinylmania (who must notice no change at all) and **maintainers** (who get a smaller, easier codebase with fewer third-party dependencies). Every story is a behavior-preserving cleanup: success means less code and fewer dependencies with zero observable regression.

### User Story 1 - Drop dependencies the platform already provides (Priority: P1)

A maintainer installs, runs, tests and deploys the backend and the end-to-end suite exactly as today, but the project no longer depends on the two third-party packages whose job the runtime and test runner already do (findings 5 and 6).

**Why this priority**: Removing a dependency is the cheapest, lowest-risk cut with lasting value (smaller install and supply-chain surface, fewer upgrade chores), and every other story is independent of it.

**Independent Test**: Remove the dependencies, then run the backend dev server, backend test suite, backend production start, and e2e suite; all behave exactly as before, and the removed packages are absent from the manifests.

**Acceptance Scenarios**:

1. **Given** a local environment file with backend settings, **When** the maintainer starts the backend in dev or production mode, **Then** the settings are loaded exactly as before.
2. **Given** the backend test command, **When** it runs, **Then** the code under test still sees the "test" environment, and the full suite passes.
3. **Given** the e2e suite's environment file, **When** the e2e suite starts, **Then** its settings are loaded exactly as before and the suite passes.
4. **Given** a missing environment file, **When** the backend starts, **Then** it behaves as it does today (it does not crash solely because the file is absent).

---

### User Story 2 - One source of truth for URL-reflected filters (Priority: P2)

A collector filtering their library or search results (format, genre, style, page) sees the same URL behavior as today — filters are reflected in the URL, shared links reproduce the same view, unrecognized values are silently dropped — but both pages now share one implementation instead of two ~80% identical copies (finding 3).

**Why this priority**: Largest remaining line savings and removes a real drift risk (a fix applied to one page but not the other), with limited blast radius.

**Independent Test**: For both pages, apply filters, reload, share the URL, paste malformed values, and navigate pages; results match the current release.

**Acceptance Scenarios**:

1. **Given** the library page, **When** the collector applies filters and reloads, **Then** the same filters and page are restored from the URL.
2. **Given** the search page with a query, **When** the collector applies filters, **Then** the URL carries the query plus the filters, exactly as today.
3. **Given** a URL with unrecognized filter values, **When** either page loads, **Then** those values are ignored and the rest apply.
4. **Given** the library page with no filters, **When** the URL is built, **Then** it has no trailing query string, as today.

---

### User Story 3 - Code hygiene: delegating wrappers, dead values, needless exports (Priority: P3)

A maintainer reading the codebase no longer finds functions that only forward to another function, a returned value nobody reads, or symbols exported but never imported elsewhere (findings 7, 8, 10).

**Why this priority**: Pure readability; no user or dependency impact, smallest value.

**Independent Test**: Type-check, lint and the full test suites pass; a search shows no remaining delegate-only cache functions, no unused `ready` value, and no export of a symbol used only in its own file (except where tests import it).

**Acceptance Scenarios**:

1. **Given** the cache adapter, **When** a use case calls its cache-aside or invalidation operation, **Then** behavior (including fail-soft on cache outage and single-flight coalescing) is unchanged.
2. **Given** the detail pages, **When** they render on desktop and mobile, **Then** the independent-column layout is unchanged after the unused value is removed.
3. **Given** a symbol whose `export` is removed, **When** the project type-checks, **Then** no importer breaks.

---

### Edge Cases

- A symbol flagged as file-local is actually imported by a test file: keep its export.
- The runtime's built-in env-file loading throws when the file is absent, whereas the old loader silently skipped it: the backend must still start without a local env file (e.g. in CI or production, where settings come from the environment).
- Environment variables already set in the shell must still win over values in the env file, as today.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The backend and e2e suite MUST no longer declare the env-file loader dependency; env settings MUST load with the same precedence and the same behavior when the file is absent.
- **FR-002**: The backend MUST no longer declare the test-environment setter dependency; the code under test MUST still run with the "test" environment.
- **FR-003**: Library and search URL-filter parsing and URL building MUST share one implementation; the only page-specific difference kept MUST be the search query parameter and the base path.
- **FR-004**: Cache adapter operations that only delegate MUST be replaced by direct references to the underlying functions, with unchanged behavior.
- **FR-005**: The unused `ready` value MUST be removed from the column-layout hook.
- **FR-006**: Symbols exported but used only within their own file (and not imported by tests) MUST lose their `export`.
- **FR-007**: Every change MUST be preceded by (or covered by existing) tests that pin current behavior, per the Test-First principle; no existing test may be deleted to make a change pass except tests of deleted code.
- **FR-008**: The work MUST NOT change any user-visible behavior, API contract, or stored data.

### Out of Scope

- **Finding 1 (CSS-only column layout)**: excluded. It would make mobile reading/focus order diverge from visual order (WCAG 2.1 AA 1.3.2 / 2.4.3), violating the non-negotiable Accessibility principle and spec 065's explicit "no DOM reordering" constraint.
- **Finding 2 (overlays → native modal dialog)**: rejected during planning (research.md R2). Measured in both configured browser engines, the native modal lets Tab escape to the browser chrome, so the hand-written focus trap must stay; the remaining gain (~30 lines of Escape/focus-restore code) does not justify restructuring the animated overlay and its tested DOM structure.
- **Finding 4 (reduced-motion hook → animation library's hook)**: rejected during planning (research.md R3). The library's hook reads the preference once and does not react to OS setting changes, which the current hook (and existing behavior) does.
- **Finding 9 (HTTP client → built-in fetch)**: deferred. It removes a dependency but no code, touches ~10 integration adapters plus retry classification, and carries regression risk disproportionate to the gain. Revisit when those adapters are changed for another reason.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Third-party dependency declarations drop by 3 (two backend, one e2e).
- **SC-002**: Net production source shrinks by at least 50 lines across the in-scope findings.
- **SC-003**: 100% of existing backend, frontend and e2e tests pass (excluding tests of deleted code), including all accessibility checks.
- **SC-004**: Zero user-visible changes: collectors cannot tell the release apart from the previous one in any flow.

## Assumptions

- The runtime version used locally, in CI and in production supports built-in env-file loading (local runtime is v26).
- The test runner sets the "test" environment by default when none is set.
- This is a PATCH-level change (no breaking changes, no new functionality).
