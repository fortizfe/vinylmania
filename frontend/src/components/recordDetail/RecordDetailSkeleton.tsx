import { useMemo, useRef, type ReactNode } from 'react';

import { useIndependentColumnLayout, type ColumnSlot } from '../../hooks/useIndependentColumnLayout';
import { Card } from '../ui/Card';
import { Skeleton } from '../ui/Skeleton';

/**
 * Loading placeholder for the three record-detail views. It mirrors the
 * `RecordDetailLayout` shape — a single stacked column on mobile, a narrow
 * left column (gallery, rating, streaming) plus a wider right column (general
 * info, tracklist, catalog) on `lg:` and up — so the skeleton → content swap
 * reserves the same footprint and causes no layout shift (UI Design System —
 * "No layout shift"; FR-021).
 *
 * Uses the SAME `useIndependentColumnLayout` hook, with the identical
 * gallery/rating/streaming = rail, generalInfo/tracklist/catalog = content
 * mapping as `RecordDetailLayout` (feature 065, US1, T007), so the two can
 * never drift apart — they run the same positioning code, not a
 * hand-kept-in-sync copy (FR-008/SC-005).
 *
 * View-agnostic: the loading state does not yet know whether the record is in
 * the library, so it renders no "Estado de mi copia" block. The action bar is
 * chrome, not a card, and is likewise omitted.
 *
 * The pulse is `motion-safe:` only (see `Skeleton`), so nothing animates under
 * `prefers-reduced-motion`.
 */

function Block({
  testId,
  className,
  children,
}: {
  testId: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Card data-testid={testId} padding="sm" className={className}>
      {children}
    </Card>
  );
}

export function RecordDetailSkeleton() {
  const galleryRef = useRef<HTMLDivElement>(null);
  const generalInfoRef = useRef<HTMLDivElement>(null);
  const ratingRef = useRef<HTMLDivElement>(null);
  const streamingRef = useRef<HTMLDivElement>(null);
  const tracklistRef = useRef<HTMLDivElement>(null);
  const catalogRef = useRef<HTMLDivElement>(null);

  const slots: ColumnSlot[] = useMemo(
    () => [
      { key: 'gallery', ref: galleryRef, column: 'rail' },
      { key: 'generalInfo', ref: generalInfoRef, column: 'content' },
      { key: 'rating', ref: ratingRef, column: 'rail' },
      { key: 'streaming', ref: streamingRef, column: 'rail' },
      { key: 'tracklist', ref: tracklistRef, column: 'content' },
      { key: 'catalogInfo', ref: catalogRef, column: 'content' },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps -- refs are stable
    [],
  );

  const { styleFor, containerStyle } = useIndependentColumnLayout(slots);

  return (
    <div
      data-testid="record-detail-skeleton"
      className="flex flex-col gap-4"
      style={containerStyle}
    >
      {/* §1 — gallery: a square cover, matching ReleaseImageGallery. */}
      <div ref={galleryRef} style={styleFor('gallery')}>
        <Block testId="record-detail-skeleton-gallery">
          <Skeleton className="aspect-square w-full" />
        </Block>
      </div>

      {/* §2 — general information: title + meta + a few detail rows. */}
      <div ref={generalInfoRef} style={styleFor('generalInfo')}>
        <Block testId="record-detail-skeleton-general-info">
          <div className="flex flex-col gap-3">
            <Skeleton className="h-7 w-2/3" />
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="mt-2 h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-4/5" />
          </div>
        </Block>
      </div>

      {/*
        §3 — rating card. Mirrors RatingCard's exact footprint so the
        skeleton → content swap causes no layout shift (FR-021 / SC-008 / T043):
        the `h-7 mb-3` heading placeholder matches its `<h2 class="mb-3 text-lg">`
        and the `min-h-[7.5rem]` lives on the INNER two-column region — same as
        RatingCard — not on the outer Card. Keep both in sync with RatingCard.
      */}
      <div ref={ratingRef} style={styleFor('rating')}>
        <Block testId="record-detail-skeleton-rating">
          <Skeleton className="mb-3 h-7 w-28" />
          <div className="flex min-h-[7.5rem] flex-col gap-4 sm:flex-row sm:gap-8">
            <div className="flex flex-1 flex-col gap-2">
              <Skeleton className="h-4 w-36" />
              <Skeleton className="h-8 w-28" />
            </div>
            <div className="flex flex-1 flex-col gap-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-11 w-44" />
            </div>
          </div>
        </Block>
      </div>

      {/*
        §4 — streaming card. `min-h-[4.5rem]` matches StreamingLinksSection's
        RESERVED_HEIGHT so a late Apple-Music resolve does not shift layout
        (FR-014 / FR-021).
      */}
      <div ref={streamingRef} style={styleFor('streaming')}>
        <Block testId="record-detail-skeleton-streaming" className="min-h-[4.5rem]">
          <div className="flex flex-col gap-3">
            <Skeleton className="h-5 w-40" />
            {/* h-11: matches StreamingLinksSection's resolved 44px link row and
                its loading-state `h-11` bar, so a late resolve does not jump. */}
            <Skeleton className="h-11 w-36" />
          </div>
        </Block>
      </div>

      {/* §5 — tracklist: a stack of track rows. */}
      <div ref={tracklistRef} style={styleFor('tracklist')}>
        <Block testId="record-detail-skeleton-tracklist">
          <div className="flex flex-col gap-3">
            <Skeleton className="h-5 w-32" />
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-4 w-full" />
            ))}
          </div>
        </Block>
      </div>

      {/* §6 — rest of catalog information. */}
      <div ref={catalogRef} style={styleFor('catalogInfo')}>
        <Block testId="record-detail-skeleton-catalog">
          <div className="flex flex-col gap-3">
            <Skeleton className="h-5 w-1/3" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-2/3" />
          </div>
        </Block>
      </div>
    </div>
  );
}
