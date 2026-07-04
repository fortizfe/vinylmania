---

description: "Task list template for feature implementation"
---

# Tasks: Separate Vercel Deployments for Backend and Frontend

**Input**: Design documents from `/specs/005-vercel-separate-projects/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/vercel-config.md, quickstart.md

**Tests**: N/A as automated tests — this feature is deployment configuration with
no application code change (see plan.md's Constitution Check, Principle I
adaptation). `quickstart.md`'s deployment-level checks are the acceptance test
for each phase and are referenced explicitly below instead of a separate test
task type.

**Organization**: Tasks are grouped by user story to enable independent
implementation and verification of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)
- Include exact file paths in descriptions
- Tasks marked **(operator action)** require a human with Vercel/GitHub
  dashboard access and cannot be executed by an automated agent — they are
  still listed so the sequence is complete and reviewable.

## Path Conventions

Existing **web app** structure: `backend/` and `frontend/` at the repo root
(unchanged), plus a new `docs/` directory for the deployment guide, per plan.md's
Project Structure section.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Retire the old combined config and confirm the repo has no secret
already exposed, before either project gets its own config

- [X] T001 Delete the root `vercel.json` (superseded per FR-006; contract:
      contracts/vercel-config.md "Root `vercel.json`")
- [X] T002 [P] Re-run the secret-exposure audit from research.md §5 —
      `git log --all --oneline -- '*.env*'` and confirm `.gitignore` still
      covers `.env`, `.env.local`, `.env*.local` for both `backend/` and
      `frontend/` (no file changes expected; this is a verification checkpoint
      before adding new config files)

**Checkpoint**: No conflicting root config remains; confirmed clean secret
baseline before proceeding.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: N/A — there is no shared blocking infrastructure beyond Phase 1.
`backend/vercel.json` and `frontend/vercel.json` are independent files with no
cross-references (Principle II), so each user story's Phase 3+ work can start
directly after Setup. This phase is intentionally empty.

---

## Phase 3: User Story 1 - Backend deployable as its own independent Vercel project (Priority: P1) 🎯 MVP

**Goal**: The backend is live as a standalone Vercel project, reachable at its
own URL, with its existing routes and configuration working unchanged.

**Independent Test**: Create a Vercel project rooted at `backend/`, deploy it
alone (no frontend project involved), and confirm `/health` and the existing
`/api/*` routes respond correctly at that project's own URL (quickstart.md
"Backend deployed independently").

### Implementation for User Story 1

- [X] T003 [US1] Create `backend/vercel.json` with the `api/index.ts` function
      declaration and catch-all rewrite, exactly per
      contracts/vercel-config.md "`backend/vercel.json`" (depends on T001)
- [ ] T004 [US1] **(operator action)** Create the `vinylmania-backend` Vercel
      project via "Import Git Repository" against `fortizfe/vinylmania`,
      setting Root Directory to `backend`, per data-model.md §1
- [ ] T005 [US1] **(operator action)** Configure the backend project's
      Production environment variables (`FIREBASE_SERVICE_ACCOUNT_KEY`,
      `FIREBASE_PROJECT_ID`, `DISCOGS_TOKEN`, `DISCOGS_USER_AGENT`) per
      data-model.md §3; set `FRONTEND_ORIGIN` to a placeholder for now (updated
      in T010 once the frontend URL is known)
- [ ] T006 [US1] **(operator action)** Deploy the backend project and verify
      per quickstart.md's automated + manual "Backend deployed independently"
      checks (`curl .../health`)

**Checkpoint**: User Story 1 is fully deployed and independently verifiable —
the backend works standalone with no frontend project required.

---

## Phase 4: User Story 2 - Frontend deployable as its own independent Vercel project (Priority: P2)

**Goal**: The frontend is live as a standalone Vercel project that correctly
calls the separately-deployed backend and handles deep-link/refresh navigation
without 404s.

**Independent Test**: Create a Vercel project rooted at `frontend/`, deploy it
with its backend base URL configured, and confirm the app loads, signs a user
in, loads library data from the backend project, and that a direct
navigation/refresh on a nested route (e.g. record detail) does not 404
(quickstart.md "Frontend deployed independently..." and "No layout-shift-
causing 404s on deep links").

### Implementation for User Story 2

- [X] T007 [P] [US2] Create `frontend/vercel.json` with the SPA fallback
      catch-all rewrite, exactly per contracts/vercel-config.md
      "`frontend/vercel.json`" (depends on T001; independent of US1's tasks)
- [X] T008 [P] [US2] Update the dev-proxy comment in `frontend/vite.config.ts`
      that currently references "root vercel.json" (now removed per T001) to
      describe the new two-project routing instead
- [ ] T009 [US2] **(operator action)** Create the `vinylmania-frontend` Vercel
      project via "Import Git Repository" against the same repo, setting Root
      Directory to `frontend`, per data-model.md §2
- [ ] T010 [US2] **(operator action)** Configure the frontend project's
      Production environment variables — `VITE_API_BASE_URL` set to the
      backend project's real URL from T006, plus the 6 `VITE_FIREBASE_*`
      variables — per data-model.md §3 (depends on T006, T009)
- [ ] T011 [US2] **(operator action)** Update the backend project's
      `FRONTEND_ORIGIN` (set as a placeholder in T005) to the frontend
      project's real URL from T009, then redeploy the backend (depends on
      T005, T009)
- [ ] T012 [US2] **(operator action)** Redeploy the frontend project (env var
      changes require a rebuild) and verify per quickstart.md's "Frontend
      deployed independently..." and "No layout-shift-causing 404s on deep
      links" manual scenarios (depends on T010, T011)

**Checkpoint**: User Stories 1 AND 2 both work independently and together — the
frontend and backend are two separate Vercel projects that correctly reach each
other.

---

## Phase 5: User Story 3 - Repeatable, secret-safe setup guide (Priority: P3)

**Goal**: A written, step-by-step guide exists so this setup can be reproduced
or handed off without reverse-engineering the configuration, and without ever
requiring a real secret value to be written into the repository.

**Independent Test**: Follow the guide from a clean checkout with no prior
Vercel project and confirm it results in both projects being live and working,
without the guide ever instructing the reader to commit or paste a real secret
value into a tracked file (quickstart.md "Guide completeness").

### Implementation for User Story 3

- [X] T013 [US3] Write `docs/deployment-vercel.md` covering: creating both
      Vercel projects (Import Git Repository + Root Directory per project),
      the full environment variable catalog per project (name, purpose, and
      where the real value comes from — never the value itself, per
      data-model.md §3), the variable-ordering dependency between the two
      projects (data-model.md §4), and how to verify each deployment
      (referencing quickstart.md's checks)
- [X] T014 [US3] Add a "## Deployment" section to `README.md` linking to
      `docs/deployment-vercel.md`, following the existing pattern of linking to
      spec quickstart guides elsewhere in that file
- [X] T015 [US3] Review `docs/deployment-vercel.md` end-to-end and confirm zero
      real secret values appear anywhere in it — only variable names and
      placeholder/example non-secret strings (FR-008; quickstart.md "No secret
      exposure")

**Checkpoint**: All three user stories are complete — both projects are live,
independently verified, and the setup is fully documented without exposing any
secret.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Final repo-wide verification across all stories

- [X] T016 [P] Run
      `git log -p --all -- backend/vercel.json frontend/vercel.json docs/deployment-vercel.md`
      and confirm no real credential value appears in any commit (quickstart.md
      "No secret exposure", SC-004)
- [X] T017 Confirm the root `vercel.json` is absent and both per-project
      `vercel.json` files match contracts/vercel-config.md exactly (final
      contract compliance check)
- [ ] T018 Execute quickstart.md end-to-end against the two live projects and
      record the outcome (health check, CORS preflight, sign-in + library load,
      deep-link refresh, guide dry-run)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Empty — no additional blocking prerequisites
- **User Story 1 (Phase 3)**: Depends on Setup (T001) only
- **User Story 2 (Phase 4)**: File creation (T007, T008) depends only on Setup
  (T001); the environment-variable and redeploy tasks (T010–T012) depend on
  User Story 1's backend URL existing (T006) per data-model.md §4's ordering
  dependency
- **User Story 3 (Phase 5)**: Documents the outcome of US1 + US2, so it is
  written last even though it has no hard technical dependency on their
  Vercel-side configuration being live (the guide can be drafted in parallel
  and finalized once both projects exist)
- **Polish (Phase 6)**: Depends on all three user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: No dependency on other stories — this is the MVP
  (a working, standalone backend deployment)
- **User Story 2 (P2)**: Its config file (T007) is independent of US1, but its
  environment variables and final verification require US1's backend URL to
  exist first (data-model.md §4)
- **User Story 3 (P3)**: Documents US1 and US2; best written once both are
  live so the guide can be validated against the real setup, but the file
  itself has no code dependency

### Within Each User Story

- Config file creation before project creation before environment variables
  before deploy/verify
- Story complete before moving to the next priority (recommended order:
  US1 → US2 → US3)

### Parallel Opportunities

- T002 (Setup) can run in parallel with T001
- T007 and T008 (US2 file/comment changes) can run in parallel with each other,
  and with T003 (US1's config file) once T001 is done — they touch different
  files
- T016 (Polish) can run in parallel with T017

---

## Parallel Example: Setup + early User Story work

```bash
# After T001 (delete root vercel.json), these can run in parallel:
Task: "Re-run the secret-exposure audit (T002)"
Task: "Create backend/vercel.json (T003)"
Task: "Create frontend/vercel.json (T007)"
Task: "Update frontend/vite.config.ts comment (T008)"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 3: User Story 1
3. **STOP and VALIDATE**: Run quickstart.md's "Backend deployed independently"
   check
4. At this point the backend is live and correct on its own, even before the
   frontend or the guide exist

### Incremental Delivery

1. Complete Setup → old config retired, secret baseline confirmed
2. Add User Story 1 → validate independently → backend live (MVP!)
3. Add User Story 2 → validate independently (sign-in, library load, deep-link
   refresh) → both projects live and talking to each other
4. Add User Story 3 → validate independently (guide dry-run) → fully documented
5. Each story adds value without breaking the previous ones

### Solo Operator Strategy

This feature's file-editing tasks (T001–T003, T007–T008, T013–T015) can be done
by an agent; the Vercel/GitHub dashboard tasks (T004–T006, T009–T012, and the
live verification in T018) require a human operator with account access. Do the
file-editing tasks first in one pass, then hand off the operator-action tasks
as a checklist.

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Tasks marked **(operator action)** cannot be completed by an automated agent
  — they require real Vercel/Firebase/Discogs account access and are listed for
  completeness and sequencing only
- FR-005/FR-008/SC-004 (no secret exposure) are gated by T002, T015, and T016 —
  do not mark this feature done if any of those three checks fail
- Commit after each file-editing task or logical group, following Conventional
  Commits per the constitution's Development Workflow section
