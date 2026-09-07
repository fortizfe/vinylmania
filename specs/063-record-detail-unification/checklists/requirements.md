# Specification Quality Checklist: Unified Record Detail Views

**Purpose**: Validate specification completeness and quality before proceeding to planning
**Created**: 2026-09-07
**Feature**: [spec.md](../spec.md)

## Content Quality

- [x] No implementation details (languages, frameworks, APIs)
- [x] Focused on user value and business needs
- [x] Written for non-technical stakeholders
- [x] All mandatory sections completed

## Requirement Completeness

- [x] No [NEEDS CLARIFICATION] markers remain
- [x] Requirements are testable and unambiguous
- [x] Success criteria are measurable
- [x] Success criteria are technology-agnostic (no implementation details)
- [x] All acceptance scenarios are defined
- [x] Edge cases are identified
- [x] Scope is clearly bounded
- [x] Dependencies and assumptions identified

## Feature Readiness

- [x] All functional requirements have clear acceptance criteria
- [x] User scenarios cover primary flows
- [x] Feature meets measurable outcomes defined in Success Criteria
- [x] No implementation details leak into specification

## Notes

- All three specification-time clarifications resolved in the 2026-09-07 session:
  1. FR-016 — the wishlist notes field is retired from the UI; the Discogs wantlist
     note value is left untouched (reversible, no data loss).
  2. FR-017 — "Other users' reviews" is fully out of scope with no reserved slot;
     documented as pending a future data source.
  3. FR-022 — layout direction "media-left + liner-notes column" adopted (mobile
     baseline = single priority-ordered column). Chosen from a 3-option design
     decision brief published as an artifact. **Selected at spec time as "sticky
     media rail"; the sticky behaviour was dropped during implementation** — see
     the FR-022 Clarifications adjustment and the Implementation outcome note below.
- The spec names existing page/component identifiers (`ReleaseDetailPage`,
  `RecordDetailPage`, `MasterReleaseDetailPage`) only to identify the surfaces being
  changed or excluded — acceptable for a redesign of named existing screens, not
  prescriptive implementation.
- `/speckit-clarify` session 2026-09-07 (round 2) resolved 4 further points: Rating
  card is always rendered with a neutral "not rated" fallback (FR-004); community
  rating reuses the existing color-banded badge and personal rating the existing star
  control, no new widget (FR-008); Discogs have/want counts move into the Rating card
  and section 6 drops all community data (FR-005a); all transactional actions move to
  a consistent action bar under the back-link (FR-012, FR-020).
- Deferred to `/speckit-plan`: whether the two page components converge into one; how
  the sticky rail handles a tall multi-image gallery; confirming the detail payload
  already carries the community rating + have/want counts.
- Ready for `/speckit-plan`.

## Implementation outcome (Phase 8, 2026-09-07)

Spec-quality checkboxes above are unchanged — every requirement stayed testable and
the built feature matches the spec's intent. What shipped, and where the build
deviated from the spec-time wording (spec / plan / contracts already updated):

- **Layout**: shipped as a **media-left two-column** grid (narrow left column =
  gallery + Rating card + streaming card; wide right column = general-info + tracklist
  + rest-of-catalog, with "Estado de mi copia" inserted after general-info in the
  library view only). **Not `position: sticky`** — a genuine sticky rail requires one
  contiguous DOM subtree wrapping the three left sections, which would break the flat
  contract DOM order the spec mandates for keyboard / screen-reader traversal (FR-022,
  Principle X) and whose stacking context trapped the gallery's fullscreen overlay
  under the app header. The desktop win is deliberate use of horizontal space, not a
  pinned rail. FR-022 Clarifications, plan.md and contracts/ui-contracts.md were
  amended mid-implementation to record this.
- **Wishlist notes**: fully retired. The note field/UI was deleted outright in US2
  (not deferred to a later home). Vinylmania no longer reads, writes, or deletes the
  Discogs wantlist note from the detail view (SC-007 verified by an e2e network
  assertion).
- **"Other users' reviews" (section 7)**: omitted entirely, with no reserved or hidden
  slot (FR-017), pending a future data source.
- **Heading levels**: corrected app-wide (WCAG 1.3.1). `ReleaseDetailsSection` title
  `h3`→`h1`; `ReleaseTracklistSection` and `StreamingLinksSection` `h4`→`h2`;
  `ReleaseAdditionalInfoSection` gained a `<section>` + `<h2>`. These three shared
  components also render on the master page — the change is level-only and master
  heading queries are name-based, so FR-023 holds (master specs byte-for-byte
  unchanged, all green).
- **Rating card**: always rendered; community half uses the existing color-banded
  `ReleaseRatingBadge` + count + have/want; personal half is the existing editable
  `StarRating` ("Tu valoración") only in library / wishlist views, with
  per-interaction autosave and a retry-on-failure alert. No new rating widget.
- **Success criteria**: **all of SC-001…SC-010 and the FR-023 regression met — no
  exceptions.** Full SC → evidence table in `tasks.md` "Phase 8 / DoD". Suites at
  close: Vitest 803 passed; targeted e2e 140 passed / 0 failed / 0 flaky (chromium +
  webkit); axe (serious/critical) clean on all three views in light and dark.
