import type { ReactNode } from 'react';
import clsx from 'clsx';

import { Card } from '../ui/Card';
import { Skeleton } from '../ui/Skeleton';

/**
 * Loading placeholder for the three record-detail views. It mirrors the
 * `RecordDetailLayout` shape — a single stacked column on mobile, a narrow
 * left rail (gallery, rating, streaming) plus a wider right column (general
 * info, tracklist, catalog) on `lg:` and up — so the skeleton → content swap
 * reserves the same footprint and causes no layout shift (UI Design System —
 * "No layout shift"; FR-021).
 *
 * View-agnostic: the loading state does not yet know whether the record is in
 * the library, so it renders no "Estado de mi copia" block. The action bar is
 * chrome, not a card, and is likewise omitted.
 *
 * The pulse is `motion-safe:` only (see `Skeleton`), so nothing animates under
 * `prefers-reduced-motion`.
 */

const railSlot = 'lg:col-start-1';
const columnSlot = 'lg:col-start-2';

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
  return (
    <div
      data-testid="record-detail-skeleton"
      className={clsx(
        'flex flex-col gap-4',
        'lg:grid lg:grid-cols-[minmax(0,20rem)_minmax(0,1fr)] lg:items-start lg:gap-x-6 lg:gap-y-6',
      )}
    >
      {/* §1 — gallery: a square cover, matching ReleaseImageGallery. */}
      <Block testId="record-detail-skeleton-gallery" className={railSlot}>
        <Skeleton className="aspect-square w-full" />
      </Block>

      {/* §2 — general information: title + meta + a few detail rows. */}
      <Block testId="record-detail-skeleton-general-info" className={columnSlot}>
        <div className="flex flex-col gap-3">
          <Skeleton className="h-7 w-2/3" />
          <Skeleton className="h-4 w-1/3" />
          <Skeleton className="mt-2 h-4 w-full" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-4/5" />
        </div>
      </Block>

      {/*
        §3 — rating card. Reserves the RatingCard's shared min-height so the
        empty/populated/error states never shift (contracts §C4). Keep this
        value in sync with RatingCard when it lands (feature 063 Phase 3).
      */}
      <Block
        testId="record-detail-skeleton-rating"
        className={clsx(railSlot, 'min-h-[7.5rem]')}
      >
        <div className="flex flex-col gap-3">
          <Skeleton className="h-5 w-24" />
          <div className="flex flex-col gap-3 sm:flex-row sm:gap-6">
            <Skeleton className="h-8 w-28" />
            <Skeleton className="h-8 w-28" />
          </div>
        </div>
      </Block>

      {/*
        §4 — streaming card. `min-h-[4.5rem]` matches StreamingLinksSection's
        RESERVED_HEIGHT so a late Apple-Music resolve does not shift layout
        (FR-014 / FR-021).
      */}
      <Block
        testId="record-detail-skeleton-streaming"
        className={clsx(railSlot, 'min-h-[4.5rem]')}
      >
        <div className="flex flex-col gap-3">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-9 w-full" />
        </div>
      </Block>

      {/* §5 — tracklist: a stack of track rows. */}
      <Block testId="record-detail-skeleton-tracklist" className={columnSlot}>
        <div className="flex flex-col gap-3">
          <Skeleton className="h-5 w-32" />
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-4 w-full" />
          ))}
        </div>
      </Block>

      {/* §6 — rest of catalog information. */}
      <Block testId="record-detail-skeleton-catalog" className={columnSlot}>
        <div className="flex flex-col gap-3">
          <Skeleton className="h-5 w-1/3" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-2/3" />
        </div>
      </Block>
    </div>
  );
}
