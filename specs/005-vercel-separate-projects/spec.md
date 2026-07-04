# Feature Specification: Separate Vercel Deployments for Backend and Frontend

**Feature Branch**: `005-vercel-separate-projects`

**Created**: 2026-07-04

**Status**: Draft

**Input**: User description: "quiero preparar el proyecto para ir montando el despliegue en vercel como dos proyectos separados. Backend por un lado y frontend por otro lado. se necesita adaptar y preparar la configuración necesaria para soportar esta modalidad. Tambien quiero que crees una guía paso a paso sobre como montar esta estructura en vercel. Hay que tener en cuenta que no se debe exponer ningun secret."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Backend deployable as its own independent Vercel project (Priority: P1)

As the project maintainer, I want the backend to be deployable as a standalone Vercel
project (its own URL, its own build, its own environment variables), so it can be
released, scaled, and configured independently from the frontend.

**Why this priority**: Without a working, independently reachable backend
deployment, the frontend has nothing to call. This is the foundation the rest of the
split depends on.

**Independent Test**: Can be fully tested by creating a Vercel project rooted at
`backend/`, deploying it on its own (with no frontend project involved), and
confirming its API endpoints (`/health`, `/api/auth/...`, `/api/discogs/...`,
`/api/library/...`) respond correctly at that project's own URL.

**Acceptance Scenarios**:

1. **Given** a new Vercel project configured with `backend/` as its root, **When**
   it is deployed, **Then** the deployment succeeds and `/health` returns a
   successful response at the project's own domain.
2. **Given** the backend project is deployed, **When** a request is made to any of
   its existing API routes, **Then** the request is handled by the same
   application logic that exists today (no route paths change).
3. **Given** the backend project's required configuration values (Discogs token,
   Firebase project id, Firebase service account credentials, allowed frontend
   origin(s)) are set as that project's environment variables, **When** the backend
   starts, **Then** it behaves identically to today's combined deployment for the
   same inputs.

---

### User Story 2 - Frontend deployable as its own independent Vercel project (Priority: P2)

As the project maintainer, I want the frontend to be deployable as a standalone
Vercel project that talks to the separately-deployed backend over its configured
URL, so the two halves of the application can be released and rolled back
independently.

**Why this priority**: This is the other half of the split; it depends on User
Story 1 existing (a backend URL to point at) but is otherwise independently
verifiable once that URL is available.

**Independent Test**: Can be fully tested by creating a Vercel project rooted at
`frontend/`, deploying it on its own with its backend base URL configured, and
confirming the app loads, signs a user in, and successfully calls the backend for
library/catalog data — plus confirming that navigating directly to (or refreshing)
a nested route like the record-detail page does not fail.

**Acceptance Scenarios**:

1. **Given** a new Vercel project configured with `frontend/` as its root, **When**
   it is deployed, **Then** the deployment succeeds and the landing page loads at
   that project's own domain.
2. **Given** the frontend project has its backend base URL configured as an
   environment variable, **When** a signed-in user browses their library or a
   record's detail, **Then** the requests reach the separately-deployed backend
   project and succeed.
3. **Given** a user directly opens or refreshes a nested application URL (e.g. the
   add-record or record-detail page), **When** the page loads, **Then** it renders
   the application instead of a not-found error.

---

### User Story 3 - Repeatable, secret-safe setup guide (Priority: P3)

As the project maintainer, I want a written, step-by-step guide for creating and
configuring both Vercel projects, so the deployment can be set up once now and
reproduced or handed off later without reverse-engineering the configuration —
and without ever needing to write a real secret value into the repository.

**Why this priority**: The configuration changes from User Stories 1 and 2 are
only safely repeatable if the exact steps (project creation, root directory,
environment variables per project) are written down; this is lower priority than
the configuration itself but is an explicit deliverable the maintainer asked for.

**Independent Test**: Can be fully tested by following the guide from a clean
checkout with no prior Vercel project and confirming it results in both
projects being live and working, without the guide ever instructing the reader to
commit or paste a real secret value into a tracked file.

**Acceptance Scenarios**:

1. **Given** the guide, **When** a maintainer follows it from scratch, **Then**
   they end up with two working Vercel projects (backend and frontend) without
   needing to consult any other source.
2. **Given** the guide, **When** it lists required environment variables for
   either project, **Then** it names each variable and where its value comes from
   without ever printing or requiring a real secret value in the guide text or in
   any file tracked by git.
3. **Given** the guide, **When** it describes verifying the deployment, **Then**
   it includes concrete checks (e.g., which URL/endpoint to open, what a
   successful sign-in/library load looks like) rather than only listing setup
   steps.

---

### Edge Cases

- What happens if someone deploys the backend project without setting the
  Firebase service-account/Discogs environment variables? The deployment must
  still build successfully and fail gracefully/observably at request time rather
  than crashing the whole function opaquely, consistent with existing
  observability expectations.
- What happens when the frontend's backend base URL is misconfigured or missing?
  Requests must fail with a clear, user-visible error state rather than silently
  calling the wrong host.
- What happens to preview deployments (e.g., a pull request) once the projects
  are split? Only the production deployment of each project is in scope for this
  feature; frontend/backend preview deployments are not required to be able to
  reach each other, and this is documented as a known limitation in the guide
  rather than solved by this feature.
- Is there already a live Vercel deployment today using the current combined root
  `vercel.json`? No — this is a from-scratch setup; no Vercel project exists yet
  for this repository, so there is nothing to migrate or decommission.
- Should the guide assume the default `*.vercel.app` project URLs, or document
  custom domains? The guide uses Vercel's default project URLs for both
  projects; custom domain configuration is out of scope and can be layered on
  later without revisiting this feature.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The repository MUST provide a deployment configuration that allows
  the backend to be deployed as an independent Vercel project (rooted at
  `backend/`), serving its existing API routes (`/health`, `/api/auth/...`,
  `/api/discogs/...`, `/api/library/...`) without requiring the frontend to be
  part of the same deployment.
- **FR-002**: The repository MUST provide a deployment configuration that allows
  the frontend to be deployed as an independent Vercel project (rooted at
  `frontend/`), building and serving the single-page application such that direct
  navigation to, or a refresh of, any application route resolves correctly instead
  of returning a not-found error.
- **FR-003**: The frontend MUST call the backend exclusively through a
  configurable base URL; no backend domain MAY be hardcoded in frontend source
  code.
- **FR-004**: The backend MUST restrict cross-origin requests to an explicitly
  configured allow-list of frontend origin(s), configurable per deployment/
  environment without a code change.
- **FR-005**: No real secret value (Firebase service-account credentials, Discogs
  token, or any other credential) MUST be committed to the repository, printed in
  documentation, or included in this feature's guide at any point; every secret
  MUST be configured exclusively through Vercel's per-project environment
  variable storage.
- **FR-006**: The repository's existing single-project Vercel configuration (the
  combined root configuration that builds the frontend and routes `/api/*` to the
  backend within one deployment) MUST be replaced with the two-project
  configuration so the two setups cannot be mistakenly mixed.
- **FR-007**: A written, step-by-step deployment guide MUST be added to the
  repository covering: creating both Vercel projects, setting each project's root
  directory and build settings, the full list of required environment variables
  per project (named, with a description of what each controls and where its real
  value should come from — never the value itself), and how to verify each
  project's deployment succeeded.
- **FR-008**: The guide MUST explicitly instruct that real secret values are
  never to be pasted into any file tracked by git, and MUST reference
  configuration only by variable name/placeholder.
- **FR-009**: Every functional requirement, acceptance scenario, and guide step
  produced by this feature MUST be verifiable without introducing a new backend
  route, a new frontend page, or any other change to the application's existing
  user-facing behavior — this feature is deployment configuration only.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: The backend can be deployed and verified as a working, independent
  Vercel project without the frontend being present in that deployment.
- **SC-002**: The frontend can be deployed and verified as a working, independent
  Vercel project that successfully authenticates a user and loads their library
  data from the separately-deployed backend.
- **SC-003**: Navigating directly to, or refreshing, any application route on the
  deployed frontend succeeds 100% of the time (no not-found errors).
- **SC-004**: Zero real secret values appear anywhere in the git history, tracked
  files, or the written guide produced by this feature.
- **SC-005**: A maintainer unfamiliar with the prior combined setup can follow the
  written guide end-to-end and reach a fully working two-project deployment
  without needing additional undocumented steps.

## Assumptions

- The existing single combined Vercel configuration (root `vercel.json`) is being
  superseded by this feature's two-project configuration; it is not required to
  remain usable afterward.
- The backend's existing `FRONTEND_ORIGIN`-based CORS allow-list and the
  frontend's existing `VITE_API_BASE_URL`-based API base URL are the mechanisms
  this feature builds on, since both already exist in the codebase for exactly
  this purpose.
- No new application functionality, route, or page is introduced by this
  feature; it is limited to deployment configuration, environment variable
  wiring, and documentation.
- Firebase and Discogs credentials continue to be managed as a single set of
  production values (no new multi-environment credential strategy is introduced).
- No Vercel project currently exists for this repository; this is a from-scratch
  setup, not a migration of an existing deployment.
- Only the production deployment of each project is in scope; preview
  deployments (pull requests/branches) are not required to reach each other and
  this is documented as a known limitation rather than solved here.
- Both projects use Vercel's default `*.vercel.app` URLs; custom domain
  configuration is out of scope for this feature.
