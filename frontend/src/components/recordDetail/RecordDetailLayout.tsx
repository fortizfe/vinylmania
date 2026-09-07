import type { ReactNode } from 'react';
import clsx from 'clsx';

import { BackLink } from '../ui/BackLink';
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
 * - Desktop (`lg:`+): a two-track CSS grid. The gallery, rating and streaming
 *   sections take the narrow left "media" track; generalInfo, myCopy, tracklist
 *   and catalogInfo take the wide right "liner-notes" track. Placement is by
 *   `lg:` column classes on the individual slot wrappers — the DOM order is
 *   untouched.
 *
 * The left track is deliberately NOT `position: sticky`. A genuinely sticky rail
 * needs a single contiguous DOM subtree wrapping the three sections, which would
 * force the mobile stack out of the contracts §C1 priority order and out of a
 * correct tab order (constitution Principle X, FR-022). Keeping the flat DOM
 * order wins; the desktop win is the deliberate use of horizontal space, not a
 * pinned rail. See research R3 / spec Clarifications.
 *
 * No entrance animation anywhere (research R8): the page is seen many times and
 * a stable, predictable layout is the point. Any rail/column boundary treatment
 * is a static 1px divider — never a blur or scroll-edge chrome (contracts §C7).
 */

// The narrow left "media" track. `lg:self-start` keeps each slot from stretching
// to its grid row height.
const railSlot = 'lg:col-start-1 lg:self-start';
// The wide right track (normal flow).
const columnSlot = 'lg:col-start-2';

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
  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-6 p-6 sm:p-8 xl:max-w-7xl">
      <BackLink to={backTo} />

      {/* §0 — action bar, first child after the back-link (contracts §C2). */}
      <div>{actions}</div>

      <div
        data-testid={RECORD_DETAIL_TESTIDS.LAYOUT}
        className={clsx(
          'flex flex-col gap-4',
          'lg:grid lg:grid-cols-[minmax(0,20rem)_minmax(0,1fr)] lg:items-start lg:gap-x-6 lg:gap-y-6',
        )}
      >
        {/* §1 — image gallery: top of the left media track. */}
        <div data-testid={RECORD_DETAIL_TESTIDS.RAIL} className={railSlot}>
          {gallery}
        </div>

        {/* §2 — general information. */}
        <div className={columnSlot}>{generalInfo}</div>

        {/* §2a — "estado de mi copia": library view only, right after §2. */}
        {myCopy != null && <div className={columnSlot}>{myCopy}</div>}

        {/* §3 — rating (left media track). */}
        <div className={railSlot}>{rating}</div>

        {/* §4 — streaming services (left media track); may render null. */}
        <div className={railSlot}>{streaming}</div>

        {/* §5 — tracklist. */}
        <div className={columnSlot}>{tracklist}</div>

        {/* §6 — rest of catalog information; may render null. */}
        <div className={columnSlot}>{catalogInfo}</div>
      </div>
    </main>
  );
}
