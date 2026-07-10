# Feature Specification: README Open-Source Refresh

**Feature Branch**: `030-readme-oss-refresh`

**Created**: 2026-07-10

**Status**: Draft

**Input**: User description: "Ahora que hemos hecho público el repositorio, hay que darle cariño al readme.md principal que se ve al entrar en github. Retócalo y añade los principios básicos del proyecto desde la perspectiva de la licencia de codigo libre que hemos añadido. Se cuidadoso teniendo en cuenta que el repo está público."

## Clarifications

### Session 2026-07-10

- Q: The "be careful, repo is public" audit for sensitive content — does it cover only `README.md` itself, or also the documentation files the README links to directly (deployment guide, quickstarts)? → A: Scope includes both `README.md` and the documents it links to directly (deployment guide, quickstarts) — all must be checked for secrets/internal-only detail.
- Q: How should the README point people to a commercial-license contact, given the repo is now public and the LICENSE has no contact email? → A: Point to opening a GitHub Issue / the maintainer's GitHub profile — no personal email address is placed in the README.
- Q: Should the refreshed README (including the new license/principles section) stay English-only, or add a Spanish version/summary? → A: English-only, consistent with the rest of the repository (specs, constitution, code).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Evaluate the project and its license at a glance (Priority: P1)

A visitor who lands on the public GitHub repository (a prospective user, collector,
or engineer scouting open-source projects) reads the README and, without opening any
other file, understands what Vinylmania does and what they are and are not allowed to
do with the code under its license.

**Why this priority**: The README is the first and often only artifact a public GitHub
visitor reads. If it does not make the license's practical implications clear up
front, visitors may either wrongly assume they can use the project commercially
(license violation) or wrongly assume it's fully proprietary and walk away.

**Independent Test**: Have someone unfamiliar with the project read only the README
top-to-bottom and then answer: "What does this app do?" and "Could I resell this as a
paid hosted service?" Success is a confident, correct answer to both from the README
alone.

**Acceptance Scenarios**:

1. **Given** the README's opening section, **When** a visitor reads it, **Then** they
   can state the project's purpose (a Discogs-powered vinyl collection app with
   ratings and related music news, rock/metal-focused) without reading further.
2. **Given** the README's license section, **When** a visitor reads it, **Then** they
   correctly understand that non-commercial use, modification, and redistribution are
   permitted, and that commercial resale or paid hosting of the software (or a
   derivative service) is not, without needing to open the full `LICENSE` file.
3. **Given** the README's license section, **When** a visitor wants the exact legal
   terms, **Then** they find a clear link to the `LICENSE` file rather than a
   duplicated, potentially-diverging copy of the legal text.

---

### User Story 2 - Understand contribution expectations (Priority: P2)

A developer interested in contributing reads the README and understands, at a basic
level, the spirit in which contributions are welcomed (open-source, non-commercial)
before opening a pull request.

**Why this priority**: Reduces wasted effort and confused/rejected PRs (e.g., someone
proposing to build a paid hosted version) by setting expectations early, but is
secondary to the baseline understanding covered in User Story 1.

**Independent Test**: A developer reads the README and can state, without asking a
maintainer, whether their planned contribution (e.g., a bug fix vs. a commercial
fork) fits the project's licensing spirit.

**Acceptance Scenarios**:

1. **Given** the README, **When** a developer looks for how to get involved, **Then**
   they find a short statement of the project's open-source expectations (e.g., stay
   open source, non-commercial) alongside or near the license section.

---

### User Story 3 - No sensitive information is exposed now that the repo is public (Priority: P1)

A maintainer reviewing the refreshed README (now that the repository is public)
confirms that no secrets, credentials, internal-only infrastructure details, or other
sensitive information are present anywhere in the file, or in the documentation files
the README links to directly (e.g., the deployment guide, feature quickstarts).

**Why this priority**: Equal priority to User Story 1 — a polished, welcoming README
is worthless (and actively harmful) if it leaks information that should not be public,
whether directly or one click away through a linked doc. This is a safety gate on the
rest of the feature, not a nice-to-have.

**Independent Test**: Diff the refreshed README against the previous version and
confirm every added or retained line contains no credentials, API keys, tokens,
internal hostnames/URLs, environment variable values, or other non-public detail —
only project description, public setup instructions, and license/contribution
information. Additionally, open every document directly linked from the README
(deployment guide, quickstarts) and confirm none of them expose the same categories
of sensitive content.

**Acceptance Scenarios**:

1. **Given** the refreshed README, **When** it is reviewed line by line, **Then** it
   contains zero secrets, credentials, or private infrastructure identifiers.
2. **Given** the refreshed README's setup/testing/deployment sections, **When**
   compared to the previous version, **Then** any content that must remain (e.g., how
   to run the project locally) is preserved accurately, with only generic, already
   publishable instructions retained.
3. **Given** a documentation file directly linked from the README (e.g.,
   `docs/deployment-vercel.md`, a `specs/*/quickstart.md`), **When** it is reviewed,
   **Then** it contains zero secrets, credentials, or private infrastructure
   identifiers; any found MUST be redacted or generalized as part of this feature.

---

### Edge Cases

- What happens if the existing README (prior to this refresh) already contains an
  internal link, service name, or instruction that is not appropriate for a public
  audience? It MUST be identified and removed or generalized as part of this change.
- How does the README handle a reader who only skims the top of the page (the part
  visible without scrolling on GitHub)? The project's purpose and the existence of a
  license restriction on commercial use MUST both be discoverable within that initial
  view or immediately below it.
- What happens if a future contributor wants to propose a commercial/paid variant?
  The README's license framing MUST make clear this requires a separate agreement
  with the copyright holder, rather than leaving it ambiguous.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The README MUST state the project's purpose near the top: a modern
  Discogs-powered vinyl collection app combining collector ratings and related music
  news, with a rock/metal editorial focus, consistent with the project constitution.
- **FR-002**: The README MUST include a license/open-source section that summarizes,
  in plain non-legal language, the practical implications of the project's license:
  free to use, modify, and redistribute for non-commercial purposes; any project
  incorporating the code MUST remain open source under the same license; commercial
  resale or offering the software (or a derivative service) as a paid product is not
  permitted without a separate commercial license from the copyright holder. This
  section MUST point interested parties to a GitHub Issue or the maintainer's GitHub
  profile to discuss a commercial license, and MUST NOT include a personal email
  address or other direct personal contact detail.
- **FR-003**: The README MUST link to the repository's `LICENSE` file as the
  authoritative legal text and MUST NOT restate the full legal text inline.
- **FR-004**: The README MUST include a short statement of basic contribution
  expectations consistent with the license's non-commercial, open-source spirit.
- **FR-005**: The README MUST NOT contain secrets, credentials, API keys, tokens,
  internal-only hostnames/URLs, or other non-public infrastructure detail. Any such
  content present before this change MUST be removed or replaced with a public-safe
  equivalent (e.g., "see internal docs" removed, or generalized instructions).
- **FR-005a**: Every documentation file directly linked from the README (e.g., the
  Vercel deployment guide, per-feature `quickstart.md` files) MUST also be checked for
  the same categories of sensitive content as FR-005, and any found MUST be redacted
  or generalized as part of this feature.
- **FR-006**: The README MUST preserve existing accurate, public-safe technical
  content (stack overview, local setup, testing, deployment) unchanged, other than
  the specific edits required by FR-001, FR-002, and FR-004.
- **FR-007**: The README's license section MUST be internally consistent with the
  full `LICENSE` file (AGPL-3.0 modified by the Commons Clause License Condition
  v1.0) — no claim in the README MAY grant broader permissions than the LICENSE
  actually grants.
- **FR-008**: The README MUST remain English-only, consistent with the rest of the
  repository (specs, constitution, code); this feature MUST NOT introduce a Spanish
  translation or bilingual sections.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A first-time reader can correctly state, within 30 seconds of opening
  the README, both what the project does and whether they may use it commercially.
- **SC-002**: Every license-related statement in the README is verifiably consistent
  with (does not contradict or overstate) the `LICENSE` file.
- **SC-003**: A line-by-line review of the refreshed README finds zero secrets,
  credentials, or private infrastructure identifiers.
- **SC-004**: A reader can identify all three product pillars (Discogs integration,
  ratings, music news) from the README's opening section alone, without opening any
  other file.

## Assumptions

- The existing `LICENSE` file (AGPL-3.0 modified by the Commons Clause License
  Condition v1.0) is final and authoritative; this feature summarizes it in the
  README but does not alter its terms.
- "Basic principles of the project from the license's perspective" means a short,
  plain-language summary of the license's practical implications (open-source reuse
  yes, commercial resale no) placed prominently in the README, not a full legal FAQ
  or a new CONTRIBUTING.md file.
- No new legal document is required by this feature; if the user later wants a
  dedicated `CONTRIBUTING.md` or `CODE_OF_CONDUCT.md`, that would be a separate
  follow-up.
- The existing technical content in the README (stack, local setup, testing,
  deployment) is materially accurate; this feature reorganizes and polishes
  tone/structure rather than re-verifying every technical claim from scratch, except
  for the sensitive-content audit explicitly required by FR-005/FR-005a, which does
  extend to documents directly linked from the README.
- "Being careful because the repo is public" refers to auditing for accidental
  exposure of sensitive information in the README text itself, not adding new
  security controls to the application.
- The `## Stack` section is not required to gain new bullets for ratings/news
  features as part of this change; the opening paragraph (FR-001) is sufficient to
  convey the three pillars. Deeper Stack-section coverage of ratings/news is a
  separate, future documentation improvement if desired.
