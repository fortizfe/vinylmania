# Implementation Plan: Metal Storm Dashboard Images & E2E Suite Stabilization

**Branch**: `036-metalstorm-images-e2e-fixes` | **Date**: 2026-07-12 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/036-metalstorm-images-e2e-fixes/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command. See `.specify/templates/plan-template.md` for the execution workflow.

## Summary

Two independent bug fixes. (1) Metal Storm's News feed does carry image
information, but through a non-standard `data-image-url` attribute on
`<a class="ms-link">` anchors inside the item's HTML content, using a
relative path — not through `<enclosure>`, `<img src>`, or Media RSS, all
already checked. `extractImageUrl` gains a third extraction tier that reads
that attribute and resolves it to an absolute URL against the source's feed
URL; Metal Storm's other four categories (reviews/interviews/articles/staff
picks) genuinely carry no image data and correctly keep showing the
placeholder. (2) Of the 9 failing e2e tests, research confirmed 4 distinct
root causes, only one of which is a real application bug: Cluster A (2
tests) assert a "Dashboard" heading the UI no longer has — test-only fix.
Cluster B (5 tests) hit a Playwright strict-mode violation because
`getByText('Stockholm')` matches both the release title and an unrelated
notes paragraph — test-only fix (role-based locator). Cluster C (1 test) is
neither of those: its mocked fixture omits the `identifiers` field that the
real backend always sends, crashing `ReleaseAdditionalInfoSection` at
render and unmounting the app — test-fixture fix, with an optional
defense-in-depth guard in the component. Cluster D (1 test) is a confirmed
real layout bug: at ≤375px the always-visible "Sign out" button overflows
its grid column and intercepts clicks on the header's Search button — fixed
by moving "Sign out" into the existing `HamburgerMenu` (already `md:`-gated
and already using a 44px-tall row pattern), removing it from the header row
below `md`.

## Technical Context

**Language/Version**: TypeScript ~6.0 (backend Node/Express, frontend React 19.2)

**Primary Dependencies**: `rss-parser` + `axios` (backend feed fetching/parsing, unchanged); no new dependencies — relative→absolute URL resolution uses Node's built-in `URL` (no existing helper in the codebase, confirmed by search; none needed, this is a one-line stdlib call)

**Storage**: N/A — no data/schema changes; `imageUrl` is an existing `Article` field, only its extraction logic changes

**Testing**: Jest (`backend/tests/unit/feedMapper.test.ts`, existing conventions — fixture `FeedSourceConfig` + `Parser.Item`-shaped objects, asserting on `mapFeedItem(...)?.imageUrl`); Vitest (frontend, for the optional `ReleaseAdditionalInfoSection` hardening test); Playwright (`e2e/`, the primary surface for Cluster A–D — each cluster's fix is validated by making its already-existing, currently-failing test pass, per Principle I this "test already written and red" satisfies test-first without needing new spec files, consistent with spec.md FR-011's "no new e2e coverage beyond what's needed")

**Target Platform**: Web (existing Vercel-deployed SPA + Express API)

**Project Type**: Web application (existing `frontend/` + `backend/` + `e2e/` split) — this feature touches all three

**Performance Goals**: No new performance targets; the image-extraction change adds one more regex/URL-resolution pass per feed item, negligible versus existing network I/O

**Constraints**: No behavior change to Metal Injection/MetalSucks/Louder Sound image extraction (FR-003); no `Article`/`FeedSourceConfig` schema changes beyond passing the already-in-scope `source` param one level deeper (FR-004); e2e fixes MUST NOT paper over real bugs by only loosening test expectations (FR-012) — Clusters C and D specifically require an app-side fix; the `HamburgerMenu` restructuring for Cluster D MUST preserve the existing 44×44px touch-target floor and breakpoint-only (no device-detection) dual-layout rules from constitution v2.2.0, both already governing this exact component from a prior feature

**Scale/Scope**: 1 backend function extended (`extractImageUrl` in `feedMapper.ts`) + 1 backend unit test file extended; 4 e2e spec files fixed (`sign-in.spec.ts`, `returning-session.spec.ts`, `record-detail-inline-edit.spec.ts` ×5 assertions, `caching-navigation.spec.ts` ×2 clusters); 2 frontend components changed (`AppHeader.tsx`, `HamburgerMenu.tsx`) plus 1 optional defensive hardening (`ReleaseAdditionalInfoSection.tsx`)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle / Rule | Applies? | Assessment |
|---|---|---|
| I. Test-First (NON-NEGOTIABLE) | Yes | Image fix: new Jest cases for `extractImageUrl`'s third tier MUST be written and confirmed failing before the implementation. E2E fixes: Clusters A–D each already have a real, currently-failing (red) Playwright test — fixing the app/test to turn it green satisfies test-first without new spec files. PASS (planned). |
| II. Discogs Integration-First & Modularity | No | No Discogs calls, caching, or data modules touched (the optional `ReleaseAdditionalInfoSection` hardening only guards against undefined `identifiers`, doesn't change how Discogs data is fetched/normalized). N/A. |
| III. Simplicity, YAGNI & KISS | Yes | Image fix reuses the existing three-tier `extractImageUrl` pattern and Node's built-in `URL`, no new dependency. Cluster D fix reuses `HamburgerMenu`'s existing `md:`-gated, 44px-row nav-list pattern verbatim rather than inventing a new icon-button variant. PASS. |
| IV. SOLID | Yes | No new class hierarchies; `extractImageUrl` gains one parameter and one more early-return tier, consistent with its existing shape. PASS. |
| V. Observability | Yes | Malformed `data-image-url` values fall through to `undefined` silently, consistent with the existing two tiers' behavior (no logging added for a missing enclosure or missing `<img>` today either) — no new observability gap introduced. PASS. |
| VI. Versioning & Breaking Changes | Yes | Both `backend` (image extraction) and `frontend` (header layout, e2e-driven component hardening) change — bug fixes only, no contract/schema break → PATCH bump + `CHANGELOG.md` entry in **both** packages, per Principle VI and the per-package changelog gate. PASS (planned). |
| VII. Curated Ratings & Music News | Yes | The image fix directly serves this principle's news-aggregation surface; it does not touch attribution (source name, publish date, link to original), which stays intact — only the thumbnail image source. PASS. |
| UI Design System — Dual responsive layout | Yes | `HamburgerMenu`'s existing `md:`-gated modal is reused unchanged in kind; "Sign out" moves into it as one more `min-h-11` row, no device detection introduced. PASS. |
| UI Design System — 44×44 touch target | Yes | The relocated "Sign out" row reuses `HamburgerMenu`'s existing nav-link row styling (already `min-h-11` per feature 035), so it inherits the floor rather than needing new sizing logic. PASS. |
| UI Design System — Reusable atomic components | Yes | No new ad-hoc styles; `HamburgerMenu`'s existing `<Link>`-row pattern and `AppHeader`'s existing `Button` usage are both reused as-is. PASS. |
| Dev Workflow — e2e coverage required for `/frontend` PRs | Yes | The `caching-navigation.spec.ts` tests for Clusters C and D already exist and already cover the affected flows; no new spec files needed per FR-011, but the full existing header/touch-target suite (`header-responsive-nav.spec.ts`) MUST be re-run to confirm the `HamburgerMenu` restructuring introduces no regression. PASS (planned). |
| Dev Workflow — CHANGELOG + version bump | Yes | `backend/CHANGELOG.md` (`0.13.0` → `0.13.1`, PATCH) and `frontend/CHANGELOG.md` (`0.22.0` → `0.22.1`, PATCH) entries required in the same PR. PASS (planned). |
| Dev Workflow — Conventional Commits | Yes | Commits MUST use `fix(backend):` / `fix(frontend):` / `fix(e2e):` or `test(e2e):` as appropriate. PASS (process constraint). |

**Result**: No violations requiring justification. No entries needed in Complexity Tracking.

## Project Structure

### Documentation (this feature)

```text
specs/036-metalstorm-images-e2e-fixes/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md         # Phase 1 output (/speckit-plan command) — N/A, no schema change; documents why
├── quickstart.md         # Phase 1 output (/speckit-plan command)
├── checklists/
│   └── requirements.md   # Spec quality checklist (/speckit-specify command)
└── tasks.md               # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

No `contracts/` directory is generated: this feature changes no API endpoint
request/response shape (the `Article.imageUrl` field already exists in the
contract; only which feed-content patterns populate it changes) and no new
public interface is introduced.

### Source Code (repository root)

```text
backend/
├── src/feeds/
│   ├── feedMapper.ts        # touched: extractImageUrl gains a 3rd tier (data-image-url) + source param
│   ├── feedSources.ts       # reference only — NOT touched (FeedSourceConfig.feedUrl already usable as base URL)
│   └── feedClient.ts        # reference only — NOT touched
└── tests/unit/
    └── feedMapper.test.ts   # touched: new cases for the data-image-url tier + the 4 image-less Metal Storm categories

frontend/
├── src/components/
│   ├── AppHeader.tsx                    # touched: remove "Sign out" from the always-visible header row below `md`
│   ├── HamburgerMenu.tsx                # touched: add a "Sign out" row to the existing nav list
│   └── ReleaseAdditionalInfoSection.tsx # touched (optional hardening): guard identifiers with (identifiers ?? [])
├── src/pages/
│   └── DashboardPage.tsx                # touched: add data-testid="dashboard-page" (Cluster A stable test hook)
└── tests/unit/
    ├── HamburgerMenu.test.tsx                    # touched: cover the new sign-out row / callback wiring (existing file, extended)
    └── ReleaseAdditionalInfoSection.test.tsx      # touched: cover rendering without throwing when identifiers is undefined

e2e/tests/
├── sign-in.spec.ts                  # touched (Cluster A): replace stale "Dashboard" heading assertion
├── returning-session.spec.ts        # touched (Cluster A): replace stale "Dashboard" heading assertion
├── record-detail-inline-edit.spec.ts # touched (Cluster B): role-based locator for the release title, ×5 call sites
├── caching-navigation.spec.ts       # touched (Cluster C only): fixture identifiers field; Cluster D portion re-verified, not edited
└── header-responsive-nav.spec.ts    # touched: extend the existing mobile 44px assertions block to cover the relocated "Sign out" row
```

**Structure Decision**: Existing `frontend/` + `backend/` + `e2e/` split
(Web application, Option 2) is unchanged. This feature touches all three
directories for the first time in this spec pair, but each touched file is
a small, targeted change to existing modules — no new packages, directories,
or top-level structure.

## Complexity Tracking

*No entries — Constitution Check reported no unjustified violations.*
