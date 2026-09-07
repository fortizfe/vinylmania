import type { ComponentType } from 'react';
import clsx from 'clsx';

import { useStreamingLinks } from '../queries/streamingQueries';
import type { ReleaseIdentifier } from '../services/libraryApi';
import { RECORD_DETAIL_TESTIDS } from './recordDetail/testIds';
import { Card } from './ui/Card';
import { focusRing } from './ui/focusRing';
import { pressable } from './ui/press';
import { AppleMusicIcon } from './ui/icons/AppleMusicIcon';
import { SpotifyIcon } from './ui/icons/SpotifyIcon';
import { Skeleton } from './ui/Skeleton';

interface PlatformDisplayMeta {
  /** Visible text label — never rely on the icon shape/colour alone (FR-018). */
  label: string;
  /** Inline SVG glyph, coloured via `currentColor`. Decorative (`aria-hidden`). */
  Icon: ComponentType<{ className?: string }>;
  /** Accessible name for the anchor, identifying the platform (FR-018). */
  ariaLabel: string;
}

/**
 * Static, presentational-only display registry keyed by platform id (feature
 * 062, data-model.md "Platform display metadata"). A link whose `platform` has
 * no row here is skipped silently, so the frontend never has to ship in
 * lockstep with a new backend resolver.
 *
 * To add a platform: add a row here + its icon; the backend adds an adapter
 * (see backend/src/ports/streaming/streamingResolverPort.ts). Nothing else
 * changes — not the Apple Music row, not the render loop below (FR-006 / SC-008).
 */
const PLATFORM_META: Record<string, PlatformDisplayMeta> = {
  apple_music: {
    label: 'Apple Music',
    Icon: AppleMusicIcon,
    ariaLabel: 'Escuchar en Apple Music',
  },
  spotify: {
    label: 'Spotify',
    Icon: SpotifyIcon,
    ariaLabel: 'Escuchar en Spotify',
  },
};

const HEADING_ID = 'streaming-links-heading';

/**
 * Single reserved height carried by the outer Card in BOTH the skeleton and the
 * populated state, so the first-view skeleton -> populated swap introduces zero
 * layout shift (FR-017). The section is mounted last on every detail surface, so
 * the skeleton -> collapsed (`null`) transition only reflows empty space below
 * it — the accepted collapse (research.md §7).
 */
const RESERVED_HEIGHT = 'min-h-[4.5rem]';

/**
 * All three detail-page mount points lay their content out in the same
 * `lg:grid-cols-2` grid with full-width cards below the fold. `lg:col-span-2` is
 * inert anywhere else, so the one class keeps the component drop-in.
 */
const CARD_SPAN = 'lg:col-span-2';

interface StreamingLinksSectionProps {
  /** Release identifiers; `Barcode`-typed values feed the barcode lookup. */
  identifiers?: ReleaseIdentifier[];
  /** Primary artist display name. Resolution is disabled without it. */
  artist?: string;
  /** Release / master title. Resolution is disabled without it. */
  title?: string;
}

/**
 * "Escúchalo en streaming" — the reusable section that links a record out to the
 * streaming platforms where it actually exists (feature 062, US1).
 *
 * It renders nothing at all unless a platform produced a reliable match: no
 * broken link, no error state, no "search on <platform>" fallback (FR-004 /
 * FR-009 / FR-014). While a first, uncached resolution runs it shows a
 * fixed-height skeleton; on a transient failure or a confirmed no-match it
 * collapses to `null`.
 */
export function StreamingLinksSection({
  identifiers,
  artist,
  title,
}: StreamingLinksSectionProps) {
  const barcodes = (identifiers ?? [])
    .filter((identifier) => identifier.type === 'Barcode')
    .map((identifier) => identifier.value);

  const { data, isLoading, isError } = useStreamingLinks({ barcodes, artist, title });

  // No usable inputs, or a transient resolution failure: the rest of the detail
  // page renders normally and this section is simply absent (FR-005 / FR-014).
  if (!artist || !title) return null;
  if (isError) return null;

  if (isLoading) {
    return (
      <Card
        padding="sm"
        className={clsx(CARD_SPAN, RESERVED_HEIGHT)}
        data-testid={RECORD_DETAIL_TESTIDS.STREAMING_CARD}
      >
        <div data-testid="streaming-links-skeleton" className="flex flex-col gap-3">
          <Skeleton className="h-5 w-44" />
          <Skeleton className="h-11 w-36" />
        </div>
      </Card>
    );
  }

  // Iterate the resolved links generically: each is shown iff `PLATFORM_META`
  // has a row for its `platform` id. No `if (platform === 'apple_music')`
  // anywhere — a new platform is one metadata row + one backend adapter (FR-006).
  const links = (data?.links ?? []).filter((link) =>
    Object.hasOwn(PLATFORM_META, link.platform),
  );
  if (links.length === 0) return null;

  return (
    <Card
      padding="sm"
      className={clsx(CARD_SPAN, RESERVED_HEIGHT)}
      data-testid={RECORD_DETAIL_TESTIDS.STREAMING_CARD}
    >
      <section aria-labelledby={HEADING_ID} className="flex flex-col gap-3">
        <h4 id={HEADING_ID} className="font-semibold text-stone-900 dark:text-stone-100">
          Escúchalo en streaming
        </h4>
        <ul className="flex flex-wrap gap-2">
          {links.map((link) => {
            const { label, Icon, ariaLabel } = PLATFORM_META[link.platform];
            return (
              <li key={link.platform}>
                <a
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={ariaLabel}
                  className={clsx(
                    // >=44x44px touch target, sits comfortably on a Card.
                    'inline-flex min-h-11 items-center gap-2 rounded-lg border px-4 py-2',
                    'border-stone-500 bg-stone-50 text-sm font-medium text-stone-900',
                    'hover:bg-stone-100',
                    'dark:border-border-dark dark:bg-surface-raised dark:text-stone-100 dark:hover:bg-stone-800',
                    // Shared press feedback (tokenised timing, reduced-motion
                    // safe) — Constitution X / XI.
                    pressable,
                    focusRing,
                  )}
                >
                  <Icon className="h-5 w-5" />
                  <span>{label}</span>
                </a>
              </li>
            );
          })}
        </ul>
      </section>
    </Card>
  );
}
