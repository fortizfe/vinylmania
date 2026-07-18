import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';

import { DiscogsRelinkNotice } from '../components/DiscogsRelinkNotice';
import { MasterReleaseDetailsSection } from '../components/MasterReleaseDetailsSection';
import { MasterVersionsTable } from '../components/MasterVersionsTable';
import { RecordDetailSkeleton } from '../components/RecordDetailSkeleton';
import { ReleaseImageGallery } from '../components/ReleaseImageGallery';
import { ReleaseTracklistSection } from '../components/ReleaseTracklistSection';
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

  const { data: master, isLoading, isError, error: masterError } = useCatalogMaster(parsedId);
  // The master fetch itself (not just an "add to library" mutation) can
  // fail with discogs_link_invalid when the caller's linked account was
  // revoked (spec 053, US3) — distinguished from a genuine 404.
  const relinkRequired =
    isError && masterError instanceof ApiError && masterError.code === 'discogs_link_invalid';
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
        <RecordDetailSkeleton />
      </main>
    );
  }

  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-6 p-6 sm:p-8 xl:max-w-7xl">
      <BackLink to={backTo} />
      <Card>
        <div
          data-testid="master-detail-content"
          className="grid grid-cols-1 items-start gap-6 lg:grid-cols-2"
        >
          <div data-testid="master-detail-gallery">
            <ReleaseImageGallery images={master.images} alt={master.title} />
          </div>

          <div data-testid="master-detail-details">
            <MasterReleaseDetailsSection master={master} />
          </div>

          <div data-testid="master-detail-tracklist" className="lg:col-span-2">
            <ReleaseTracklistSection tracklist={master.tracklist} />
          </div>

          <div data-testid="master-detail-versions" className="lg:col-span-2">
            <MasterVersionsTable
              discogsId={parsedId}
              page={versionsPage}
              onPageChange={setVersionsPage}
            />
          </div>
        </div>
      </Card>
    </main>
  );
}
