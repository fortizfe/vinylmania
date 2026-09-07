/**
 * Shared `data-testid` constants for the unified record-detail surface
 * (feature 063, contracts/ui-contracts.md §C8).
 *
 * Both route components (`ReleaseDetailPage`, `RecordDetailPage`) and the two
 * e2e suites reference the SAME id for the same section so selectors can be
 * shared. The old `release-detail-*` / mixed `record-detail-*` split collapses
 * to this single set.
 */
export const RECORD_DETAIL_TESTIDS = {
  /** The responsive section grid inside `RecordDetailLayout`. */
  LAYOUT: 'record-detail-layout',
  /** The sticky left column (gallery + rating + streaming) on `lg:` and up. */
  RAIL: 'record-detail-rail',
  /** The action bar directly under the back-link. */
  ACTIONS: 'record-detail-actions',
  /** Image gallery card (was also `release-detail-gallery-card`). */
  GALLERY_CARD: 'record-detail-gallery-card',
  /** General-information card (was also `release-detail-main-info-card`). */
  MAIN_INFO_CARD: 'record-detail-main-info-card',
  /** Standalone rating card (new in feature 063). */
  RATING_CARD: 'record-detail-rating-card',
  /** "Estado de mi copia" card — library view only. */
  YOUR_COPY_CARD: 'record-detail-your-copy-card',
  /** Streaming-links card (was `release-detail-streaming-card`). */
  STREAMING_CARD: 'record-detail-streaming-card',
  /** Tracklist card. */
  TRACKLIST_CARD: 'record-detail-tracklist-card',
  /** Rest-of-catalog-info card. */
  OTHER_DETAILS_CARD: 'record-detail-other-details-card',
} as const;

export type RecordDetailTestId =
  (typeof RECORD_DETAIL_TESTIDS)[keyof typeof RECORD_DETAIL_TESTIDS];
