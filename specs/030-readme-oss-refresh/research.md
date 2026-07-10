# Phase 0 Research: README Open-Source Refresh

All `NEEDS CLARIFICATION` items from the spec were already resolved during
`/speckit-clarify` (see spec.md `## Clarifications`). This document records the
remaining implementation-facing decisions needed before drafting the README changes,
plus the results of the pre-emptive sensitive-content audit required by FR-005a.

## Decision 1: Where the purpose/pillars statement lives

- **Decision**: Rewrite the README's existing opening paragraph (currently: "A web
  application for vinyl record collectors to manage and organize their personal
  vinyl library.") in place, immediately under the `# Vinylmania` H1, to name all
  three pillars (Discogs catalog integration, collector ratings, related music news)
  and the rock/metal editorial focus.
- **Rationale**: This is the first text any GitHub visitor sees above the fold,
  satisfying FR-001/SC-001/SC-004 without adding a new section. It mirrors the
  wording already established in the constitution's mission statement (v2.1.0),
  keeping the two documents consistent.
- **Alternatives considered**: Adding a separate "About" section further down —
  rejected because it would not be visible without scrolling, failing the
  above-the-fold requirement from the spec's Edge Cases.

## Decision 2: License section wording and placement

- **Decision**: Keep the existing `## License` section's structure and position
  (near the end of the README) but extend its plain-language paragraph to explicitly
  name the commercial-license contact path, and lightly tighten the wording for
  clarity. Continue linking to `LICENSE` for the authoritative text rather than
  duplicating it (already the case today).
- **Rationale**: The current README already has a reasonably good plain-language
  license summary; FR-002/FR-003/FR-007 are mostly satisfied already. The gap is
  narrow: no stated mechanism to *request* a commercial license. Editing in place is
  the smallest change that closes that gap (Principle III, Simplicity).
- **Alternatives considered**: Moving the License section to the top of the README —
  rejected; the spec only requires the *existence and restriction* of the license to
  be discoverable above the fold (via the opening paragraph's framing), not the full
  section, and moving it would disrupt the README's established structure with no
  added clarity.

## Decision 3: Commercial-license contact mechanism

- **Decision**: Point readers to opening a GitHub Issue on
  `fortizfe/vinylmania` (or the maintainer's GitHub profile) for commercial-license
  inquiries. No email address or other personal contact detail is added.
- **Rationale**: Resolved in `/speckit-clarify` (Q2). GitHub Issues is a channel the
  repository already has (public, low-friction, no new infrastructure), and avoids
  publishing a personal email on a now-public, highly-visible file.
- **Alternatives considered**: Direct email (rejected — privacy exposure); no contact
  path at all (rejected — leaves FR-002's "separate commercial license" claim without
  any actionable next step for a genuinely interested party).

## Decision 4: Contribution-expectations note

- **Decision**: Add one short paragraph (not a new `CONTRIBUTING.md`) near the
  License section stating that contributions are welcome in the spirit of the
  project's open-source, non-commercial license.
- **Rationale**: FR-004 only requires a "short statement," and the Assumptions in
  spec.md explicitly scope this feature to `README.md` — a dedicated
  `CONTRIBUTING.md` is out of scope unless requested separately.
- **Alternatives considered**: A full contribution guide (PR process, coding
  standards) — rejected as out of scope per spec Assumptions and Principle III.

## Pre-emptive audit: linked documents (FR-005a)

Per the `/speckit-clarify` decision (Q1), every document directly linked from the
README was checked for secrets, credentials, tokens, or other non-public
infrastructure detail before drafting changes:

| Document | Finding |
|---|---|
| `docs/deployment-vercel.md` | Clean. Explicitly instructs "never paste a real secret value into this file"; only lists env var *names* and where to obtain real values (Vercel dashboard). |
| `specs/001-landing-google-login/quickstart.md` | Clean. Only placeholder env var names/values (`...`, `<paste the full downloaded JSON as one line>`) and `localhost` URLs. |
| `specs/002-discogs-api-client/quickstart.md` | Clean. Only placeholder token syntax (`<your personal access token>`) and guidance not to paste real tokens. |
| `specs/003-vinyl-library-crud/quickstart.md` | Clean. No credentials; references `DISCOGS_TOKEN` by name only. |
| `specs/011-tanstack-redis-caching/quickstart.md` | Clean. `localhost` Redis URL example only; no real connection strings. |
| `specs/029-discogs-retry-resilience/quickstart.md` | Clean. References env var names only. |
| `.specify/memory/constitution.md` | Clean. Governance/principles prose only — no credentials, tokens, or infrastructure detail. |
| `e2e/README.md` | Clean. Referenced by name (not a markdown hyperlink) in the README's Testing section; states "No real Firebase project, Google account, or secret is required." Included for completeness per `/speckit-analyze` finding I1. |

**Outcome**: No redactions needed. FR-005a is satisfied by this audit with zero
follow-up edits to the linked documents; this is recorded in `quickstart.md` as a
completed verification step rather than a pending task.

## Phase 1 artifacts skipped

- **`data-model.md`**: Not produced. This feature introduces no entities, fields, or
  state transitions — it edits prose in a Markdown file.
- **`contracts/`**: Not produced. This feature exposes no API, CLI, or other
  machine-readable interface; the "contract" a README fulfills (accurate, discoverable
  project information) is captured directly in the spec's Functional Requirements and
  verified via `quickstart.md`.
