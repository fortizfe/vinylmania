import { useMemo, useRef, type ReactNode } from 'react';

import { BackLink } from '../ui/BackLink';
import { useIndependentColumnLayout, type ColumnSlot } from '../../hooks/useIndependentColumnLayout';
import { RECORD_DETAIL_TESTIDS } from './testIds';

interface RecordDetailLayoutProps {
  backTo: string;
  /** `RecordDetailActions` — the bar directly under the back-link. */
  actions: ReactNode;
  gallery: ReactNode;
  generalInfo: ReactNode;
  /** Present ⟺ library view ("Estado de mi copia"). */
  myCopy?: ReactNode;
  /** `RatingCard` — always provided. */
  rating: ReactNode;
  /** `StreamingLinksSection` — always provided (may render `null`). */
  streaming: ReactNode;
  tracklist: ReactNode;
  /** `ReleaseAdditionalInfoSection` — may render `null`. */
  catalogInfo: ReactNode;
}

/**
 * Shared shell for the three record-detail views (search, wishlist, library).
 *
 * DOM order is **always** the contracts/ui-contracts.md §C1 order —
 * gallery → generalInfo → (myCopy) → rating → streaming → tracklist →
 * catalogInfo — regardless of viewport (FR-022). There is one tree; the
 * responsive change is CSS only, never a reorder of the JSX and never the CSS
 * `order` property.
 *
 * - Mobile (`< lg`): a single `flex-col gap-4` column, every section full width.
 * - Desktop (`lg:`+): the gallery, rating and streaming sections form the
 *   narrow left "media" column; generalInfo, myCopy, tracklist and
 *   catalogInfo form the wide right "liner-notes" column. Each column stacks
 *   independently — `useIndependentColumnLayout` measures every slot's own
 *   height and positions it with `position: absolute` / `top`, offset only by
 *   the cumulative height of the *same-column* slots that precede it. The DOM
 *   order above is untouched; only the visual position is computed.
 *
 *   This replaces a previous CSS Grid implementation (feature 065): Grid's
 *   implicit row auto-placement shared row height across BOTH columns
 *   whenever a short rail card and a tall content card landed in the same
 *   auto-generated row, leaving a gap the size of the taller card under the
 *   shorter one (specs/065-fix-detail-column-gaps/research.md R1). Grouping
 *   the cards into two column-wrapper `<div>`s — the more common fix — was
 *   rejected because it would change the DOM/tab order (FR-005/006); the
 *   measured-offset hook keeps the exact flat DOM order below.
 *
 * The left column is deliberately NOT `position: sticky`. A genuinely sticky
 * rail needs a single contiguous DOM subtree wrapping the three sections,
 * which would force the mobile stack out of the contracts §C1 priority order
 * and out of a correct tab order (constitution Principle X, FR-022). Keeping
 * the flat DOM order wins; the desktop win is the deliberate use of
 * horizontal space, not a pinned rail. See research R3 / spec Clarifications.
 *
 * No entrance animation anywhere (research R8): the page is seen many times
 * and a stable, predictable layout is the point.
 */

export function RecordDetailLayout({
  backTo,
  actions,
  gallery,
  generalInfo,
  myCopy,
  rating,
  streaming,
  tracklist,
  catalogInfo,
}: RecordDetailLayoutProps) {
  const galleryRef = useRef<HTMLDivElement>(null);
  const generalInfoRef = useRef<HTMLDivElement>(null);
  const myCopyRef = useRef<HTMLDivElement>(null);
  const ratingRef = useRef<HTMLDivElement>(null);
  const streamingRef = useRef<HTMLDivElement>(null);
  const tracklistRef = useRef<HTMLDivElement>(null);
  const catalogInfoRef = useRef<HTMLDivElement>(null);

  const hasMyCopy = myCopy != null;

  // Order here matches the §C1 DOM order below — required by the hook's
  // contract (offsets are computed as a running total per column, walked in
  // this order).
  const slots: ColumnSlot[] = useMemo(() => {
    const base: ColumnSlot[] = [
      { key: 'gallery', ref: galleryRef, column: 'rail' },
      { key: 'generalInfo', ref: generalInfoRef, column: 'content' },
    ];
    if (hasMyCopy) {
      base.push({ key: 'myCopy', ref: myCopyRef, column: 'content' });
    }
    base.push(
      { key: 'rating', ref: ratingRef, column: 'rail' },
      { key: 'streaming', ref: streamingRef, column: 'rail' },
      { key: 'tracklist', ref: tracklistRef, column: 'content' },
      { key: 'catalogInfo', ref: catalogInfoRef, column: 'content' },
    );
    return base;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- refs are stable
  }, [hasMyCopy]);

  const { styleFor, containerStyle } = useIndependentColumnLayout(slots);

  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-6 p-6 sm:p-8 xl:max-w-7xl">
      <BackLink to={backTo} />

      {/* §0 — action bar, first child after the back-link (contracts §C2). */}
      <div>{actions}</div>

      <div
        data-testid={RECORD_DETAIL_TESTIDS.LAYOUT}
        className="flex flex-col gap-4"
        style={containerStyle}
      >
        {/* §1 — image gallery: top of the left media column. */}
        <div
          data-testid={RECORD_DETAIL_TESTIDS.RAIL}
          ref={galleryRef}
          style={styleFor('gallery')}
        >
          {gallery}
        </div>

        {/* §2 — general information. */}
        <div ref={generalInfoRef} style={styleFor('generalInfo')}>
          {generalInfo}
        </div>

        {/* §2a — "estado de mi copia": library view only, right after §2. */}
        {myCopy != null && (
          <div ref={myCopyRef} style={styleFor('myCopy')}>
            {myCopy}
          </div>
        )}

        {/* §3 — rating (left media column). */}
        <div ref={ratingRef} style={styleFor('rating')}>
          {rating}
        </div>

        {/* §4 — streaming services (left media column); may render null. */}
        <div ref={streamingRef} style={styleFor('streaming')}>
          {streaming}
        </div>

        {/* §5 — tracklist. */}
        <div ref={tracklistRef} style={styleFor('tracklist')}>
          {tracklist}
        </div>

        {/* §6 — rest of catalog information; may render null. */}
        <div ref={catalogInfoRef} style={styleFor('catalogInfo')}>
          {catalogInfo}
        </div>
      </div>
    </main>
  );
}
