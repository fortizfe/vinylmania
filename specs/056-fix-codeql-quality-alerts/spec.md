# Feature Specification: Fix CodeQL Code Quality Gate Alerts

**Feature Branch**: `056-fix-codeql-quality-alerts`

**Created**: 2026-07-19

**Status**: Draft

**Input**: User description: "Hemos añadido la gate de code quality al proceso. Debido a eso, con su integración en main, han saltado alertas en los reportes y no ha pasado. Debido a legacy del pasasdo cuando no teníamos code quality gate. Lo que quiero es que revises el informe actual y corrijas todas las alertas que hay"

## Clarifications

### Session 2026-07-19

- Q: The one open alert outside shipped application code (`docs/Vinylmania design brief/support.js`, a generated third-party design-tool export) — how should it be remediated? → A: Exclude the `docs/Vinylmania design brief/` path from the CodeQL scan configuration (path-ignore); no code fix.
- Q: The 17 missing-rate-limiting alerts span both credential-sensitive routes (login, OAuth callbacks) and general CRUD routes (library, catalog) — should they all get the same rate-limit threshold? → A: One shared, reusable middleware factory with two threshold tiers: strict for auth/login/OAuth-callback endpoints, standard for library/catalog CRUD endpoints.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Close high-severity authorization alerts without rate limiting (Priority: P1)

As a maintainer, I want every backend route handler that performs authorization to also enforce rate limiting, so that an attacker cannot abuse authenticated/authorization-checking endpoints with unbounded request volume (credential stuffing, brute force, resource exhaustion).

**Why this priority**: This is the largest alert category (17 of 25 open alerts) and the only one scored "high" security severity by the scanner across production routes (library, auth, Google auth, feeds, and Discogs catalog/OAuth). It is the primary blocker to the gate passing and the most exploitable class of finding.

**Independent Test**: Re-run the code-quality gate against `backend/src/adapters/library/libraryRoutes.ts`, `backend/src/adapters/users/authRoutes.ts`, `backend/src/adapters/googleAuth/googleAuthRoutes.ts`, `backend/src/adapters/feeds/feedsRoutes.ts`, `backend/src/adapters/discogsOauth/discogsRoutes.ts`, and `backend/src/adapters/discogsCatalog/discogsRoutes.ts` and confirm zero `missing-rate-limiting` findings remain; confirm each affected endpoint now rejects excess requests with an appropriate throttling response.

**Acceptance Scenarios**:

1. **Given** a client repeatedly calling an authorization-performing endpoint beyond its tier's defined threshold, **When** the threshold is exceeded, **Then** the server rejects further requests within the window instead of processing them.
2. **Given** normal usage volume from a single client, **When** the client calls any previously-flagged endpoint, **Then** requests are processed exactly as before rate limiting was added, with no functional regression.
3. **Given** a credential-sensitive endpoint (login, Discogs/Google OAuth callback) versus a general CRUD endpoint (library, catalog), **When** each is rate-limited, **Then** the credential-sensitive endpoint enforces a stricter threshold than the CRUD endpoint, reflecting its higher abuse risk.

---

### User Story 2 - Fix feed content sanitization defects (Priority: P1)

As a user browsing the news/RSS dashboard, I want externally-sourced feed content to be fully sanitized before it reaches my browser, so that malicious or malformed markup embedded in a third-party feed cannot execute in my session.

**Why this priority**: Both findings in `backend/src/domain/feeds/feedMapper.ts` are high-severity security defects (an incomplete multi-character sanitization that can leave `<script` fragments intact, and a double-escaping bug that can produce double-unescaped `&` sequences) in code that processes untrusted third-party input, matching the Constitution's requirement (Principle VII) that aggregated news content be handled safely.

**Independent Test**: Feed a crafted string containing an obfuscated `<script>`-like fragment and a doubly-escaped entity through the feed mapper in isolation and confirm the sanitized output contains neither.

**Acceptance Scenarios**:

1. **Given** a feed item whose raw text contains a script-like fragment split or obfuscated to evade a single-pass filter, **When** the mapper sanitizes it, **Then** the resulting output contains no executable script fragment.
2. **Given** a feed item whose raw text contains an HTML entity that would be corrupted by a second unescape pass, **When** the mapper processes it, **Then** the resulting output renders the original character exactly once, correctly.

---

### User Story 3 - Clean up remaining code-quality findings (Priority: P2)

As a maintainer, I want the remaining lower-severity findings (unused variables/imports in tests, a useless local assignment, and unanchored host-substring checks in tests) cleaned up, so the gate reports zero open alerts and future contributors inherit a clean baseline instead of legacy debt.

**Why this priority**: These findings do not block a security argument the way P1 items do, but they are required for the gate to fully pass and for the report to read as "all alerts resolved," which is the user's explicit ask.

**Independent Test**: Re-run the code-quality gate against the full repository and confirm zero remaining open alerts for `js/unused-local-variable`, `js/useless-assignment-to-local`, and `js/incomplete-url-substring-sanitization`.

**Acceptance Scenarios**:

1. **Given** the test files `scripts/__tests__/run-with-timeout.test.js` and `frontend/tests/unit/filters/CollapsibleFilterPanel.test.tsx`, **When** the gate scans them, **Then** no unused-variable/import findings remain and the tests still pass.
2. **Given** `backend/src/adapters/discogsOauth/discogsCollectionAdapter.ts`, **When** the gate scans it, **Then** no useless-assignment finding remains and existing behavior is unchanged.
3. **Given** the host-matching assertions in `backend/tests/unit/feeds/domain/feedSources.test.ts` and `backend/tests/integration/feeds/feedsDashboardExpandedSources.integration.test.ts`, **When** a URL contains the trusted host name as a substring of an untrusted host (e.g. `evil-metalblade.com.attacker.test`), **Then** the assertion correctly distinguishes it from the real trusted host.

---

### Edge Cases

- What happens when a route already sits behind an external/infrastructure-level rate limiter? The application-level control is still required, since the gate evaluates the application code itself and infrastructure-level protection is not guaranteed across all deployment targets.
- How does the system handle the one open finding located outside shipped application code (a generated, third-party design-tool export under `docs/`)? It is remediated by excluding that non-shipped path from the gate's scan scope rather than hand-editing a generated bundle that would simply be overwritten on its next export.
- What happens if a future PR reintroduces one of these same patterns (e.g., a new authorization route without rate limiting)? The gate re-flags it on that PR going forward, since the gate now runs on every PR (out of scope for this feature beyond confirming the gate itself is active and green on `main`).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST apply rate limiting to every backend route handler currently flagged as performing authorization without it, across the library, user-auth, Google-auth, feeds, Discogs catalog, and Discogs OAuth route modules (17 flagged handlers), using a single reusable rate-limiting mechanism configured with two threshold tiers: a strict tier for credential-sensitive endpoints (login, Google/Discogs OAuth callbacks) and a standard tier for general CRUD endpoints (library, catalog, feeds).
- **FR-002**: The feed content mapper MUST sanitize untrusted, externally-sourced feed text/HTML so that no script-like fragment can survive sanitization regardless of obfuscation, and MUST NOT re-process already-escaped output in a way that produces double-unescaped characters.
- **FR-003**: Test assertions that validate a URL belongs to a specific trusted host MUST anchor the match to the actual host component (not an unanchored substring check), so a lookalike domain embedding the trusted name cannot pass the check.
- **FR-004**: Unused local variables and imports flagged in test files MUST be removed without changing test behavior or coverage.
- **FR-005**: The useless local-variable assignment flagged in the Discogs collection adapter MUST be removed, since its initial value is always overwritten before use.
- **FR-006**: The code-quality gate's scan configuration MUST exclude the `docs/Vinylmania design brief/` path (a generated, third-party design-tool export that never ships to users) from analysis, so its findings do not block the gate.
- **FR-007**: After remediation, the code-quality gate MUST report zero open alerts against the `main` branch.
- **FR-008**: Every behavioral fix (rate limiting, sanitization, host-matching) MUST be covered by an automated test that fails against the pre-fix code and passes against the fixed code, consistent with the project's test-first practice.

### Key Entities

- **Code-Quality Alert**: A single finding from the gate's report, characterized by a rule identifier (e.g. `js/missing-rate-limiting`), a severity level, the file path and line it applies to, and a state (open/resolved). This feature's scope is exactly the 25 alerts currently in state "open" at the time this spec was written.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: The code-quality gate passes (zero open alerts) on the `main` branch after remediation.
- **SC-002**: 100% of the 25 currently-open alerts are resolved — each either fixed in code or, for the one non-shipped generated asset, excluded from scan scope with documented rationale.
- **SC-003**: Zero open alerts remain in any category the gate scores "high" security severity (missing rate limiting, incomplete sanitization, double-escaping, incomplete host-substring sanitization).
- **SC-004**: 100% of the existing automated test suite continues to pass after remediation, with no functional regression in the affected routes or feed rendering.
- **SC-005**: A pull request opened after this remediation, touching only unrelated code, runs the code-quality gate and merges without needing to dismiss any legacy alert.

## Assumptions

- "The code quality gate" refers to the CodeQL scanning workflow introduced in the CI pipeline; "the current report" refers to the set of alerts returned as `open` by that scanning integration at the time this spec was written (25 alerts total).
- Any alert already dismissed or closed before this spec was written is out of scope.
- `docs/Vinylmania design brief/support.js` is a generated export from a third-party design tool, not part of the deployed application; per clarification, remediation is a scan-scope exclusion rather than hand-patching a file that will be regenerated.
- Per clarification, rate limiting uses two tiers (strict for credential-sensitive endpoints, standard for CRUD); the exact numeric thresholds (requests per window, per-IP vs. per-user) within each tier are an implementation decision to be made during planning, not a specification requirement.
- Rate limiting is implemented as an adapter-layer concern (e.g. Express middleware), consistent with the project's hexagonal architecture principle — it MUST NOT introduce infrastructure dependencies into domain or application code.
- No new user-facing feature or endpoint is introduced by this work; it is remediation of existing behavior only, so no new user-facing scenarios beyond "the same functionality, now safely bounded/sanitized" apply.
