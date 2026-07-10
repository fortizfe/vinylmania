# Implementation Plan: README Open-Source Refresh

**Branch**: `030-readme-oss-refresh` | **Date**: 2026-07-10 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/030-readme-oss-refresh/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command. See `.specify/templates/plan-template.md` for the execution workflow.

## Summary

Refresh the root `README.md` now that the repository is public: (1) expand the
opening description to state Vinylmania's three product pillars (Discogs catalog
integration, collector ratings, related music news) and its rock/metal editorial
focus, per the updated constitution (v2.1.0); (2) strengthen the existing License
section with a clear, plain-language summary of the AGPL-3.0 + Commons Clause terms
and a safe (non-email) way to request a commercial license; (3) add a short
contribution-expectations note; and (4) audit the README plus every document it
links to directly for secrets or internal-only detail. No application code changes —
this is a documentation-only feature with no data model or external interface.

## Technical Context

**Language/Version**: N/A — Markdown documentation only, no application code changes

**Primary Dependencies**: N/A

**Storage**: N/A

**Testing**: Manual line-by-line review against the checklist in `quickstart.md`
(purpose/license comprehension test + sensitive-content audit); no automated test
suite applies to a static Markdown file

**Target Platform**: GitHub web UI (rendered Markdown on the repository's landing page)

**Project Type**: documentation (single file: root `README.md`, plus an audit pass
over the docs it links to)

**Performance Goals**: N/A

**Constraints**: Must not contradict or overstate `LICENSE`; must stay English-only;
must not introduce secrets, credentials, or personal contact details (see spec
Clarifications)

**Scale/Scope**: One file edited (`README.md`); up to 8 linked documents audited
(`docs/deployment-vercel.md`, 5 `specs/*/quickstart.md` files, `.specify/memory/constitution.md`,
and `e2e/README.md`, per `/speckit-analyze` findings C1/I1) — no changes expected to
the linked docs unless the audit finds an issue

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Applicability | Assessment |
|---|---|---|
| I. Test-First (NON-NEGOTIABLE) | N/A for this feature | No application code is written; there is nothing to red/green/refactor. The equivalent verification is the manual review checklist in `quickstart.md`, executed before merge. |
| II. Discogs Integration-First & Modularity | N/A | No catalog/integration code touched; the README only *describes* the existing Discogs integration. |
| III. Simplicity, YAGNI & KISS | Pass | Scope is the smallest edit that satisfies the spec: reword the opening paragraph, strengthen the existing License section, add one short Contributing note. No new files, no restructuring beyond what FR-001/002/004 require. |
| IV. SOLID Design | N/A | No code. |
| V. Observability | N/A | No runtime component. |
| VI. Versioning & Breaking Changes | Pass (not triggered) | Root `README.md` is outside `backend/` and `frontend/`, so the per-package `CHANGELOG.md`/`package.json` version-bump gate (Development Workflow) does not apply. This is a docs-only, non-breaking change. |
| VII. Curated Ratings & Music News (Rock/Metal Focus) | Pass | The refreshed opening paragraph is required to reflect this principle's three pillars and rock/metal focus (FR-001), keeping the README aligned with the constitution it links to. |

No violations. Complexity Tracking table is not needed.

## Project Structure

### Documentation (this feature)

```text
specs/030-readme-oss-refresh/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

No `data-model.md` or `contracts/` are produced for this feature — see "Phase 1
artifacts skipped" in `research.md` for rationale (no entities, no external
interface).

### Source Code (repository root)

```text
README.md                        # The only file this feature modifies
docs/deployment-vercel.md        # Audited (FR-005a), not expected to change
specs/001-landing-google-login/quickstart.md   # Audited (FR-005a), not expected to change
specs/002-discogs-api-client/quickstart.md     # Audited (FR-005a), not expected to change
specs/003-vinyl-library-crud/quickstart.md     # Audited (FR-005a), not expected to change
specs/011-tanstack-redis-caching/quickstart.md # Audited (FR-005a), not expected to change
specs/029-discogs-retry-resilience/quickstart.md # Audited (FR-005a), not expected to change
.specify/memory/constitution.md  # Audited (FR-005a), not expected to change
e2e/README.md                    # Audited (FR-005a), not expected to change
```

**Structure Decision**: Single-file documentation change at the repository root
(`README.md`). This repo already uses the standard `backend/` + `frontend/` web-app
structure (see constitution's Technology Stack), which this feature does not touch.
The eight linked documents above are read-only audit targets, not planned edits;
they are edited only if the audit in Phase 0/tasks finds a problem.

## Complexity Tracking

*Not applicable — no Constitution Check violations.*
