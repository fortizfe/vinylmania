# Phase 1 Data Model: Metal Storm Dashboard Images & E2E Suite Stabilization

**Status**: Not applicable.

This feature introduces no new entities, fields, or relationships and
changes no existing schema. `Article.imageUrl` (populated by
`extractImageUrl` in `backend/src/feeds/feedMapper.ts`) already exists as
an optional field in the news-article contract; this feature only changes
which patterns in a feed item's raw content can populate it — the shape of
`Article`, `FeedSourceConfig`, `EnrichedLibraryEntry`, or any Firestore
document is unchanged. The e2e test fixes and the `AppHeader`/
`HamburgerMenu` layout fix are presentation/test-correctness changes with
no data-model impact of their own.

No `data-model.md` content is generated beyond this note, per the plan's
Phase 1 instructions to skip artifacts that do not apply to the feature.
