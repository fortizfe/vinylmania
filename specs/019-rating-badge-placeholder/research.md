# Phase 0 Research: Placeholder Rating Badge for Unrated Releases

The feature spec is product-complete with no `[NEEDS CLARIFICATION]` markers. This document resolves the remaining implementation-shaped decisions before design.

## 1. How "unrated" is represented in the presentation layer

**Decision**: Change `presentRating` (in `frontend/src/lib/releaseRating.ts`) so it never returns `null`. It always returns a `RatingPresentation`, whose `band` is extended from `'low' | 'medium' | 'high'` to `'low' | 'medium' | 'high' | 'unrated'`. When `isRatingVisible` is `false` (no rating, zero votes, out-of-range/non-finite average, or an upstream lookup failure/timeout already surfaced as "no rating"), `presentRating` returns `{ displayValue: '-', band: 'unrated' }`.

**Rationale**: The spec (FR-002, FR-004) requires the *same component* to render in both states, differing only in text and background — so the cleanest model is one presentation function that always produces a renderable result, with the card components dropping their `rating &&` conditional entirely. This keeps the existing `isRatingVisible`/banding logic (feature 017) untouched and reused as-is; only the function's return contract changes from "nullable" to "total".

**Alternatives considered**:
- Keep `presentRating` nullable and add a second `presentUnratedFallback()` helper called from each card when the first returns `null`. Rejected: splits one decision (rated vs. unrated) across two call sites per card, which is exactly the duplication Principle IV (SOLID) and Principle III (YAGNI) warn against.
- Push the fallback decision into `ReleaseRatingBadge` itself (accept `rating: RatingPresentation | null` and render its own default). Rejected: it would let the "no rating" state bypass the same band/format validation path a real rating goes through, and it moves a data-shape decision into a purely presentational component.

## 2. Visual treatment of the placeholder state (soft gray background, text contrast)

**Decision**: Add one new theme token pair to `frontend/src/styles/global.css`'s existing `@theme` block: `--color-rating-unrated: #D1D5DB` (Tailwind `gray-300`) for light mode with `text-gray-700` (`#374151`) badge text, and `dark:bg-gray-600` (`#4B5563`) with `dark:text-gray-100` (`#F3F4F6`) for dark mode — following the same `dark:` prefix + CSS-variable pattern already used elsewhere in the app (per the UI Design System principle), rather than a single fixed color for both themes.

**Rationale**: Computed WCAG relative-luminance contrast: light mode `gray-300`/`gray-700` ≈ 6.99:1; dark mode `gray-600`/`gray-100` ≈ 6.86:1 — both comfortably clear the 4.5:1 AA bar required by FR-005. `gray-300`/`gray-600` sit clearly apart in hue-less, low-saturation territory compared with the saturated red/amber/green band colors from feature 017, satisfying FR-003's "visually distinct from the existing bands" requirement without relying on luminance alone (the existing bands already established that the numeric/text content, not color alone, is the color-independent signal — here the content is literally "-" instead of a number, reinforcing rather than weakening that signal).

**Alternatives considered**:
- Reuse an existing neutral like the thumbnail-placeholder `bg-gray-100`/`dark:bg-gray-800`. Rejected: `gray-100` against dark text is very close to the app's default page background, making the badge look like a rendering glitch rather than an intentional "no data" indicator; the spec asks for a badge that is clearly still a badge.
- Use a single gray value with no dark-mode variant. Rejected: violates the constitution's "every component, including states like this, MUST support dark mode" rule, and `gray-300` on a dark card background would itself fail contrast against the surrounding UI.

## 3. Accessible label for the placeholder state

**Decision**: `ReleaseRatingBadge` computes its `aria-label` from the band: bands `'low' | 'medium' | 'high'` keep the existing `Rating ${displayValue} out of 5` label; the new `'unrated'` band uses `Rating not available`.

**Rationale**: Spec FR-006 explicitly requires a distinct accessible label for the placeholder state rather than reusing the numeric phrasing (a screen-reader user hearing "Rating - out of 5" would be confused by the literal dash). Keying the label off `band` inside the existing component keeps the branching in one place rather than pushing an extra prop through both call sites.

**Alternatives considered**:
- Have callers (`SearchResultCard`, `RecordCard`) pass an explicit `ariaLabel` prop. Rejected: adds a prop both call sites would need to compute identically from the same `band`/`displayValue` pair the component already receives — pure duplication for no added flexibility.

## 4. Scope confirmation: no backend or contract changes

**Decision**: No changes to `backend/`, to the `/api/discogs/search` contract, or to the library API's `EnrichedLibraryEntry`/`Release.community.rating` shape. The placeholder state is derived entirely on the frontend from data (or its absence) the app already receives.

**Rationale**: Feature 017 already established that a missing/invalid/failed-lookup rating surfaces to the frontend as "no `communityRating` present" (search) or "no `community.rating` present" (library) — there is no new signal to add on the backend; this feature only changes what the frontend does with that already-existing "absent" case.

**Alternatives considered**:
- Have the backend explicitly tag results with a `ratingUnavailable: true`/error-reason field. Rejected: unnecessary — the frontend can already fully distinguish "rating present and valid" from "rating absent/invalid" using the existing `isRatingVisible` check; adding a backend field would duplicate that logic for no behavioral gain, conflicting with Principle III (YAGNI).

## 5. Test coverage strategy

**Decision**: Extend, rather than duplicate, the existing feature-017 test suites:
- `frontend/tests/unit/releaseRating.test.ts` gains cases proving `presentRating` returns the `unrated` presentation (never `null`) for: no rating, zero-count rating, out-of-range average, non-finite average.
- `frontend/tests/unit/ReleaseRatingBadge.test.tsx` gains cases proving the `unrated` band renders `-`, applies the new gray background token, and exposes the `Rating not available` label, plus a contrast assertion for the new token pair alongside the existing low/medium/high assertions.
- `e2e/tests/caching-navigation.spec.ts`'s existing "Record rating badges on search-result cards (feature 017, US1)" describe block gains a case for a search result with no `communityRating`, asserting the placeholder badge is visible (not absent).
- `e2e/tests/library-discogs-sync.spec.ts`'s existing feature-017 rating case gains a sibling case for a library release with no community rating, asserting the same.

**Rationale**: This is an additive extension of feature 017's existing, already-reviewed rating surface, not a new feature area — extending the same describe blocks/files keeps the "rated vs. unrated" contrast visible in one place per surface and avoids fragmenting rating-badge coverage across parallel spec files, consistent with Principle III (YAGNI/simplicity).
