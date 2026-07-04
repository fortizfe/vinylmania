# Phase 0 Research: Release Preview Popup — Full Details & Image Gallery

## 1. Which additional Discogs release fields to map

**Decision**: Extend the `Release` model/mapper with four new pieces of data
pulled from Discogs' `GET /releases/{id}` response, matching the spec's
Assumptions list:
- `released` → full release date (string, e.g. `"1999-05-01"`; Discogs also
  sometimes returns partial dates like `"1999"` or `"1999-05"` — pass through
  as-is, no date-parsing/reformatting).
- `notes` → free-text release notes/description.
- `identifiers[]` → `{ type, value, description? }` (e.g. Barcode,
  Matrix/Runout).
- `community` → `{ have, want, rating: { average, count } }`.

**Rationale**: These are exactly the fields the spec's Assumptions section
scoped in (FR-001), and all four are present on the standard `/releases/{id}`
payload alongside the fields already mapped today (`title`, `artists`,
`labels`, `formats`, `genres`, `styles`, `tracklist`, `images`, `year`,
`country`, `master_id`, `uri`).

**Alternatives considered**: Also mapping `videos`, `companies`/
`extraartists`, and `series` — rejected per the spec's own Assumptions
("out of scope for this increment"); they add mapper/schema surface for
fields with little decision-making value for a collector previewing a
release, and can be added later without breaking the additive shape
established here.

## 2. Redis cache staleness for already-mapped `Release` entries

**Decision**: Accept up to the existing 6h TTL (`RELEASE_CACHE_TTL_SECONDS`
in `discogsClient.ts`) of staleness after this feature deploys — a `Release`
cached under the old mapper shape simply won't show the four new fields
until its key naturally expires and gets refetched/remapped. No cache-key
versioning or manual invalidation is introduced.

**Rationale**: Per the constitution's Technology Stack section, Redis "MAY
cache Discogs responses for performance, but MUST NOT become an independent
source of truth" — the new fields are optional and additive, so a
temporarily-stale cached entry degrades gracefully (those fields just don't
render yet, exactly like a release that never had that data on Discogs).
This matches Principle III (don't add complexity — cache-key versioning —
for a self-resolving, bounded, low-stakes staleness window).

**Alternatives considered**: Bumping the cache key (e.g.
`discogs:release:v2:{id}`) to force a clean cache on deploy — rejected as
unnecessary complexity for a personal/small-scale app where a same-day
staleness window on newly-added optional fields has no meaningful cost.

## 3. Two-column / one-column breakpoint

**Decision**: Reuse the `lg:` breakpoint already established by the record
detail page redesign (010) for its own two-column/one-column switch
(`grid grid-cols-1 gap-6 lg:grid-cols-2` in `RecordDetailPage.tsx`).

**Rationale**: Spec FR-005 explicitly asks for the same "adapts fluidly to
available space" behavior already validated for 010, and reusing the same
breakpoint keeps the two closely-related surfaces (search preview vs. detail
page) consistent for the same underlying data. No container-query solution
exists elsewhere in the codebase, so introducing one here would be
inconsistent (Principle III).

**Alternatives considered**: A different/custom breakpoint (e.g. `md:` or a
popup-specific one) — rejected; nothing about the popup's content differs
enough from the detail page's already-solved two-column problem to justify a
second breakpoint convention.

## 4. Vertical thumbnail gallery implementation

**Decision**: Build `ReleaseImageGallery` as a small, self-contained
component holding local `selectedIndex` state, rendering the image at
`images[selectedIndex]` as the primary image and every image as a clickable
thumbnail in a vertical, internally-scrollable list (`overflow-y-auto` on
the thumbnail column, capped height) — plain Tailwind utilities and React
state, no new dependency.

**Rationale**: The spec's acceptance scenarios only require click-to-select
(no swipe/drag/keyboard-arrow requirement called out), and Discogs releases
typically carry a handful of images (rarely more than the low teens), well
within what a scrollable list handles without virtualization. Matches
Principle III (no library for a problem this small) and Principle II (one
component, one job — selecting which retrieved image is primary).

**Alternatives considered**: A carousel/slider library (e.g. embla,
swiper) — rejected; no existing precedent in the codebase (confirmed via
grep — zero `carousel`/`swiper`/`embla` references), and the spec doesn't
require swipe gestures or autoplay, so a library would add a dependency for
capability that isn't needed.

## 5. Modal width for the two-column layout

**Decision**: Add an additive `size` prop to the shared `Modal` component
(default preserves today's `max-w-lg` for the `center` position, used
unchanged by any other current caller; a new wider option, e.g. `max-w-3xl`,
is opted into by `ReleasePreviewModal` only).

**Rationale**: `Modal` is already reused by another caller
(`HamburgerMenu`, via the `end` position) — forking a second modal shell to
get a wider dialog would duplicate the existing backdrop/close/keyboard-Escape
logic, violating Principle II. An additive, opt-in prop keeps the existing
`center`/`end` callers' behavior byte-for-byte unchanged.

**Alternatives considered**: Hard-coding a wider `max-w-lg` → something
larger for all `center`-positioned modals — rejected, since that would be an
unreviewed behavior change for any future `center` modal caller beyond this
feature's scope.

## 6. Where new fields are typed (backend vs. frontend)

**Decision**: Extend `Release` (and the new `ReleaseIdentifier`/
`CommunityStats` sub-shapes) in `backend/src/discogs/types.ts` and the zod
schema in `backend/src/discogs/discogsMapper.ts`; mirror the exact same
field additions in `frontend/src/services/libraryApi.ts`'s `Release`
interface, matching how every existing field in this type is already
duplicated between the two files (no shared/monorepo type package exists in
this codebase).

**Rationale**: This is the codebase's existing, established pattern for the
`Release`/`CatalogImage`/etc. shapes (confirmed in both files today) — there
is no type-sharing mechanism between `backend/` and `frontend/` to plug into
instead, and introducing one would be a much larger, unrelated change than
this feature calls for (Principle III).

**Alternatives considered**: Introducing a shared types package/workspace —
rejected as disproportionate scope creep for this feature; would be a
separate, dedicated refactor if ever justified.
