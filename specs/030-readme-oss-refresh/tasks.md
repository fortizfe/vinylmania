# Tasks: README Open-Source Refresh

**Input**: Design documents from `/specs/030-readme-oss-refresh/`

**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, quickstart.md

**Tests**: Not applicable — this is a documentation-only feature (no application code). Verification is manual, via `quickstart.md`, and is represented below as explicit tasks rather than automated tests.

**Organization**: Tasks are grouped by user story to enable independent verification of each story. All stories edit or audit the same single file (`README.md`) plus a fixed set of read-only audit targets, so most tasks are sequential rather than parallel.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)
- Exact file paths are included in every task description

## Path Conventions

Single documentation file at the repository root: `README.md`. Read-only audit
targets: `docs/deployment-vercel.md`, five `specs/*/quickstart.md` files,
`.specify/memory/constitution.md`, and `e2e/README.md` (see Phase 5).

---

## Phase 1: Setup

**Purpose**: Establish a baseline to diff against, so every later change can be
traced back to a requirement.

- [X] T001 Capture the current `README.md` content as the diff baseline (e.g. `git show HEAD:README.md` or a working-tree copy) so later edits can be reviewed line-by-line against it in Phase 6

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Source the exact reference wording that both User Story 1 and User
Story 2 must stay consistent with, so FR-007 (no README claim may exceed `LICENSE`)
and the constitution's product framing aren't contradicted by ad hoc phrasing.

**⚠️ CRITICAL**: Complete before writing any README prose in Phase 3/4

- [X] T002 [P] Read `LICENSE` in full and note the exact permissions/restrictions (non-commercial use/modify/redistribute; must remain open source under the same license; no commercial resale or paid hosting without a separate commercial license) to reuse without overstatement
- [X] T003 [P] Read the mission paragraph in `.specify/memory/constitution.md` (the three pillars — Discogs integration, ratings, music news — and the rock/metal editorial focus) to source the wording for the README's opening paragraph

**Checkpoint**: Reference wording confirmed — README edits can now begin

---

## Phase 3: User Story 1 - Evaluate the project and its license at a glance (Priority: P1) 🎯 MVP

**Goal**: A first-time GitHub visitor can state Vinylmania's purpose and its
license's commercial-use restriction from the README alone.

**Independent Test**: Read only the README top-to-bottom; correctly answer "What
does this app do?" and "Could I resell this as a paid hosted service?"

### Implementation for User Story 1

- [X] T004 [US1] Rewrite the opening paragraph under the `# Vinylmania` heading in `README.md` to state the three product pillars (Discogs catalog integration, collector ratings, related music news) and the rock/metal editorial focus, per FR-001 (uses wording sourced in T003)
- [X] T005 [US1] In the `## License` section of `README.md`, tighten the existing plain-language summary and add a sentence pointing readers to open a GitHub Issue on `fortizfe/vinylmania` (or the maintainer's GitHub profile) to discuss a commercial license — no email address or other personal contact detail — per FR-002, FR-003, FR-007 (uses wording sourced in T002)
- [X] T006 [US1] Validate User Story 1 by following steps 1-2 of `specs/030-readme-oss-refresh/quickstart.md` against the edited `README.md`

**Checkpoint**: User Story 1 is independently complete and verifiable

---

## Phase 4: User Story 2 - Understand contribution expectations (Priority: P2)

**Goal**: A prospective contributor can tell, from the README alone, that
contributions are expected to stay in the open-source, non-commercial spirit of the
license.

**Independent Test**: Read the README and state whether a hypothetical contribution
(e.g., a bug fix vs. a commercial fork) fits the project's expectations.

### Implementation for User Story 2

- [X] T007 [US2] Add a short contribution-expectations statement in `README.md`, near the `## License` section, describing that contributions are welcome in the project's open-source, non-commercial spirit, per FR-004 (depends on T005 — same section of the file)
- [X] T008 [US2] Validate User Story 2 by following step 3 of `specs/030-readme-oss-refresh/quickstart.md` against the edited `README.md`

**Checkpoint**: User Stories 1 and 2 both independently complete

---

## Phase 5: User Story 3 - No sensitive information is exposed now that the repo is public (Priority: P1)

**Goal**: The finished `README.md`, and every document it links to directly,
contain zero secrets, credentials, or private infrastructure/contact details.

**Independent Test**: Line-by-line review of the finished README and its directly
linked documents finds no credentials, tokens, internal hostnames, or personal
contact details.

### Implementation for User Story 3

- [X] T009 [US3] Re-read the finished `README.md` (after T004, T005, T007) line by line and confirm zero secrets, credentials, API keys, tokens, internal-only hostnames, or personal contact details, per FR-005 (depends on T004, T005, T007)
- [X] T010 [P] [US3] Re-confirm `docs/deployment-vercel.md` contains no secrets or personal contact details, per FR-005a (already found clean in `research.md`'s Phase 0 audit — this re-confirms no drift)
- [X] T011 [P] [US3] Re-confirm `specs/001-landing-google-login/quickstart.md` contains no secrets or personal contact details, per FR-005a
- [X] T012 [P] [US3] Re-confirm `specs/002-discogs-api-client/quickstart.md` contains no secrets or personal contact details, per FR-005a
- [X] T013 [P] [US3] Re-confirm `specs/003-vinyl-library-crud/quickstart.md` contains no secrets or personal contact details, per FR-005a
- [X] T014 [P] [US3] Re-confirm `specs/011-tanstack-redis-caching/quickstart.md` contains no secrets or personal contact details, per FR-005a
- [X] T015 [P] [US3] Re-confirm `specs/029-discogs-retry-resilience/quickstart.md` contains no secrets or personal contact details, per FR-005a
- [X] T016 [P] [US3] Re-confirm `.specify/memory/constitution.md` contains no secrets or personal contact details, per FR-005a
- [X] T017 [P] [US3] Re-confirm `e2e/README.md` contains no secrets or personal contact details, per FR-005a
- [X] T018 [US3] Confirm every line of the finished `README.md` — including the new/edited text from T004, T005, T007 — is in English, per FR-008
- [X] T019 [US3] Run the full `specs/030-readme-oss-refresh/quickstart.md` validation (all 5 steps) against the finished `README.md` and record sign-off

**Checkpoint**: All three user stories independently complete; README is ready for commit

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Confirm the final diff is minimal and fully traceable to the spec.

- [X] T020 Diff the finished `README.md` against the T001 baseline and confirm every changed line traces back to FR-001, FR-002, FR-004, or FR-007 (no unrelated/stray edits), per Principle III (Simplicity)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Setup — BLOCKS Phases 3 and 4 (both quote from `LICENSE`/constitution wording)
- **User Story 1 (Phase 3)**: Depends on Foundational
- **User Story 2 (Phase 4)**: Depends on Foundational; T007 also depends on T005 (same section of `README.md`)
- **User Story 3 (Phase 5)**: Depends on Phases 3 and 4 being complete — it audits the *finished* README (T009, T018, T019), though the read-only audits of already-existing linked docs (T010-T017) could technically run any time after Phase 1
- **Polish (Phase 6)**: Depends on Phase 5 completion

### Within Each User Story

- All edits to `README.md` are sequential (same file) — no `[P]` within Phase 3/4
- Phase 5's re-confirmation of the eight *pre-existing* linked documents (T010-T017) is parallelizable — different files, no interdependency

---

## Parallel Example: Phase 2 (Foundational)

```bash
Task: "Read LICENSE for exact permissions/restrictions wording"
Task: "Read constitution.md mission paragraph for three-pillars/rock-metal wording"
```

## Parallel Example: Phase 5 (User Story 3 linked-doc audit)

```bash
Task: "Re-confirm docs/deployment-vercel.md contains no secrets"
Task: "Re-confirm specs/001-landing-google-login/quickstart.md contains no secrets"
Task: "Re-confirm specs/002-discogs-api-client/quickstart.md contains no secrets"
Task: "Re-confirm specs/003-vinyl-library-crud/quickstart.md contains no secrets"
Task: "Re-confirm specs/011-tanstack-redis-caching/quickstart.md contains no secrets"
Task: "Re-confirm specs/029-discogs-retry-resilience/quickstart.md contains no secrets"
Task: "Re-confirm .specify/memory/constitution.md contains no secrets"
Task: "Re-confirm e2e/README.md contains no secrets"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1 (Setup) and Phase 2 (Foundational)
2. Complete Phase 3 (User Story 1) — README now states its purpose and license
   restriction clearly
3. **STOP and VALIDATE**: Run quickstart.md steps 1-2
4. This alone already satisfies the feature's highest-priority need

### Incremental Delivery

1. Setup + Foundational → reference wording locked in
2. User Story 1 → validate independently (MVP)
3. User Story 2 → validate independently (adds contribution note)
4. User Story 3 → validate independently (final safety gate over the finished file
   and its linked docs)
5. Polish → confirm diff minimality, then commit

### Notes

- No parallel-team split is meaningful here beyond Phase 2 and the Phase 5 linked-doc
  audits — every prose edit lands in the same single file (`README.md`) and must be
  done sequentially.
- Commit using Conventional Commits (e.g., `docs: refresh README with product
  pillars and license principles`) per the constitution's Development Workflow — no
  `CHANGELOG.md`/`package.json` version bump is required since root `README.md` is
  outside `backend/` and `frontend/` (see plan.md Constitution Check).
