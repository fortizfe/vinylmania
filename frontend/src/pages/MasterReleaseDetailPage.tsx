import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';

import { MasterReleaseDetailsSection } from '../components/MasterReleaseDetailsSection';
import { MasterVersionsTable } from '../components/MasterVersionsTable';
import { RecordDetailSkeleton } from '../components/RecordDetailSkeleton';
import { ReleaseImageGallery } from '../components/ReleaseImageGallery';
import { ReleaseTracklistSection } from '../components/ReleaseTracklistSection';
import { BackLink } from '../components/ui/BackLink';
import { Card } from '../components/ui/Card';
import { useCatalogMaster } from '../queries/discogsQueries';

const DEFAULT_BACK_PATH = '/app/search';

export function MasterReleaseDetailPage() {
  const { discogsId } = useParams<{ discogsId: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const backTo = (location.state as { from?: string } | null)?.from ?? DEFAULT_BACK_PATH;

  const parsedId = Number(discogsId);
  const parsedPage = Number(searchParams.get('page'));
  const versionsPage = Number.isFinite(parsedPage) && parsedPage > 0 ? Math.floor(parsedPage) : 1;

  const { data: master, isLoading, isError: notFound } = useCatalogMaster(parsedId);

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

  if (notFound) {
    return (
      <main className="mx-auto flex max-w-2xl flex-col gap-6 p-6 sm:p-8">
        <BackLink to={backTo} />
        <Card>
          <p className="text-gray-500 dark:text-gray-400">
            Couldn&apos;t find that master release in the catalog.
          </p>
        </Card>
      </main>
    );
  }

  if (isLoading || !master) {
    return (
      <main className="mx-auto flex max-w-5xl flex-col gap-6 p-6 sm:p-8">
        <BackLink to={backTo} />
        <RecordDetailSkeleton />
      </main>
    );
  }

  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-6 p-6 sm:p-8">
      <BackLink to={backTo} />
      <Card>
        <div
          data-testid="master-detail-content"
          className="grid grid-cols-1 gap-6 lg:grid-cols-2"
        >
          <div data-testid="master-detail-gallery" className="lg:col-span-2">
            <ReleaseImageGallery images={master.images} alt={master.title} />
          </div>

          <div className="grid grid-cols-1 gap-4 lg:col-span-2 lg:grid-cols-2">
            <div data-testid="master-detail-details">
              <MasterReleaseDetailsSection master={master} />
            </div>

            <div data-testid="master-detail-tracklist">
              <ReleaseTracklistSection tracklist={master.tracklist} />
            </div>
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
