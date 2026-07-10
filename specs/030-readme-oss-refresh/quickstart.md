# Quickstart: Validating the README Open-Source Refresh

This is a documentation change with no application code to run. Validation is a
manual review of the rendered `README.md` against the spec's acceptance scenarios and
success criteria. No servers, builds, or test suites are involved.

## Prerequisites

- The updated `README.md` on branch `030-readme-oss-refresh`.
- A GitHub-flavored Markdown preview (GitHub's own PR/file preview, or any renderer
  that supports GFM) to check formatting and above-the-fold layout.

## Validation steps

### 1. Purpose comprehension (User Story 1, SC-001, SC-004)

1. Open the rendered README as a first-time reader would (top of the file, no
   scrolling).
2. Confirm you can state, from the opening section alone: what Vinylmania does, and
   that it names all three pillars — Discogs catalog integration, collector ratings,
   and related music news — plus the rock/metal editorial focus.
3. **Expected**: No need to scroll or open another file to answer correctly.

### 2. License comprehension (User Story 1, SC-001, SC-002)

1. Read the `## License` section only.
2. Confirm it states, in plain language: free non-commercial use/modification/
   redistribution; must remain open source under the same license; commercial
   resale/paid hosting requires a separate commercial license.
3. Confirm it links to `LICENSE` for the full text rather than repeating it.
4. Confirm it names a way to request a commercial license (GitHub Issue or maintainer
   profile) and does **not** contain a personal email address.
5. Cross-check every claim against `LICENSE` directly — nothing in the README section
   may grant broader permissions than `LICENSE` actually does.
6. **Expected**: All of the above hold; no contradiction found.

### 3. Contribution expectations (User Story 2)

1. Look for a short statement near the License section describing the spirit in
   which contributions are welcomed.
2. **Expected**: A developer can tell, from this alone, that non-commercial,
   open-source contributions fit the project's expectations.

### 4. Sensitive-content audit (User Story 3, FR-005, FR-005a, SC-003)

1. Read the entire `README.md` line by line.
2. Open every document it links to directly: `docs/deployment-vercel.md` and the
   five referenced `specs/*/quickstart.md` files (see `research.md`'s audit table for
   the exact list and prior findings).
3. **Expected**: Zero secrets, credentials, API keys, tokens, internal-only
   hostnames/URLs, or personal contact details anywhere in these files. (The Phase 0
   audit in `research.md` already found all six linked documents clean; this step
   re-confirms against the final, merged README.)

### 5. Language check (FR-008)

1. Confirm the entire README, including any newly added or edited text, is in
   English.
2. **Expected**: No Spanish text introduced by this change.

## Sign-off

All five steps passing constitutes a complete validation of this feature — no
automated test suite applies (see `plan.md` Constitution Check, Principle I).
