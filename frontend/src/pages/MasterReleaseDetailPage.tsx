import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';

import { DiscogsRelinkNotice } from '../components/DiscogsRelinkNotice';
import { MasterReleaseDetailSkeleton } from '../components/MasterReleaseDetailSkeleton';
import { MasterReleaseDetailsSection } from '../components/MasterReleaseDetailsSection';
import {
  MasterReleaseOtherDetailsSection,
  masterHasOtherDetails,
} from '../components/MasterReleaseOtherDetailsSection';
import { MasterVersionsTable } from '../components/MasterVersionsTable';
import { ReleaseImageGallery } from '../components/ReleaseImageGallery';
import { ReleaseTracklistSection } from '../components/ReleaseTracklistSection';
import { StreamingLinksSection } from '../components/StreamingLinksSection';
import { BackLink } from '../components/ui/BackLink';
import { Card } from '../components/ui/Card';
import { useCatalogMaster } from '../queries/discogsQueries';
import { ApiError } from '../services/apiClient';

const DEFAULT_BACK_PATH = '/app/search';

export function MasterReleaseDetailPage() {
  const { discogsId } = useParams<{ discogsId: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const backTo = (location.state as { from?: string } | null)?.from ?? DEFAULT_BACK_PATH;

  const parsedId = Number(discogsId);
  const parsedPage = Number(searchParams.get('page'));
  const versionsPage =
    Number.isFinite(parsedPage) && parsedPage > 0 ? Math.floor(parsedPage) : 1;

  const {
    data: master,
    isLoading,
    isError,
    error: masterError,
  } = useCatalogMaster(parsedId);
  // The master fetch itself (not just an "add to library" mutation) can
  // fail with discogs_link_invalid when the caller's linked account was
  // revoked (spec 053, US3) — distinguished from a genuine 404.
  const relinkRequired =
    isError &&
    masterError instanceof ApiError &&
    masterError.code === 'discogs_link_invalid';
  const notFound = isError && !relinkRequired;

  function setVersionsPage(nextPage: number) {
    const params = new URLSearchParams(searchParams);
    if (nextPage > 1) {
      params.set('page', String(nextPage));
    } else {
      params.delete('page');
    }
    const query = params.toString();
    navigate(`/app/masters/${discogsId}${query ? `?${query}` : ''}`, {
      replace: true,
      state: location.state,
    });
  }

  if (relinkRequired) {
    return (
      <main className="mx-auto flex max-w-2xl flex-col gap-6 p-6 sm:p-8">
        <BackLink to={backTo} />
        <DiscogsRelinkNotice />
      </main>
    );
  }

  if (notFound) {
    return (
      <main className="mx-auto flex max-w-2xl flex-col gap-6 p-6 sm:p-8">
        <BackLink to={backTo} />
        <Card>
          <p className="text-stone-500 dark:text-stone-400">
            Couldn&apos;t find that master release in the catalog.
          </p>
        </Card>
      </main>
    );
  }

  if (isLoading || !master) {
    return (
      <main className="mx-auto flex max-w-5xl flex-col gap-6 p-6 sm:p-8 xl:max-w-7xl">
        <BackLink to={backTo} />
        <MasterReleaseDetailSkeleton />
      </main>
    );
  }

  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-6 p-6 sm:p-8 xl:max-w-7xl">
      <BackLink to={backTo} />
      <div className="flex flex-col gap-4">
        {/*
          Spec 065 (US2): the gallery card and the info-stack are adjacent
          siblings sharing this row wrapper, not a shared CSS Grid row — so a
          height mismatch between them never reserves a gap under the shorter
          one (FR-001/FR-002). Flexbox's cross-axis sizing (`items-start`)
          gives each its own natural height with no shared row track.

          Spec 065 bugfix: the gallery card alone gets an explicit
          `lg:basis-[30rem]` (matching its own inner `lg:max-w-md` cap plus
          this Card's `p-4` padding on both sides). With `flex: 0 1 auto`
          (the default, still in effect here — only the basis component is
          overridden), WebKit — unlike Chromium — fails to derive a width for
          the gallery card's `aspect-square` content from that ambiguous
          auto basis, collapsing it to near-zero height (the same WebKit
          aspect-ratio/flex-sizing quirk documented for this gallery in
          feature 044, see e2e/playwright.config.ts). A fixed basis removes
          the ambiguity on both engines while reproducing the exact width
          Chromium already resolved on its own via that same `max-w-md` cap
          in the common case — an explicit `basis-1/2` on both children was
          tried first but rejected: it forces the two columns to always
          split the row exactly in half, which changes Chromium's own
          behavior when the info-stack's content is unusually large (it no
          longer lets the gallery shrink to make room, breaking the "top row
          ... much taller ... other-details content" test above). Left
          untouched, the info-stack's own `flex: 0 1 auto` still content-
          derives its width and can still shrink the gallery down via normal
          flex-shrink math when its content demands more room — only the
          gallery's basis is no longer ambiguous for WebKit's aspect-ratio
          resolution. Doesn't affect the <lg stacked layout at all.
        */}
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
          <Card
            data-testid="master-detail-gallery-card"
            padding="sm"
            className="lg:basis-[30rem]"
          >
            <ReleaseImageGallery images={master.images} alt={master.title} />
          </Card>

          <div className="flex flex-col gap-4">
            <Card data-testid="master-detail-main-info-card" padding="sm">
              <MasterReleaseDetailsSection master={master} />
            </Card>
            {masterHasOtherDetails(master) && (
              <Card data-testid="master-detail-other-details-card" padding="sm">
                <MasterReleaseOtherDetailsSection master={master} />
              </Card>
            )}
          </div>
        </div>

        <Card data-testid="master-detail-tracklist-card" padding="sm">
          <ReleaseTracklistSection tracklist={master.tracklist} />
        </Card>

        <Card data-testid="master-detail-versions-card" padding="sm">
          <MasterVersionsTable
            discogsId={parsedId}
            page={versionsPage}
            onPageChange={setVersionsPage}
          />
        </Card>

        {/*
          Feature 062 — "Escúchalo en streaming". The same reusable section as on
          ReleaseDetailPage / RecordDetailPage (FR-002, SC-007). Mounted LAST so a
          skeleton -> collapsed transition reflows only empty space below it
          (FR-017). A `MasterRelease` carries no `identifiers`, so `undefined` is
          passed and resolution falls back to the artist + title text search.
        */}
        <StreamingLinksSection
          identifiers={undefined}
          artist={master.artists[0]?.name}
          title={master.title}
        />
      </div>
    </main>
  );
}
