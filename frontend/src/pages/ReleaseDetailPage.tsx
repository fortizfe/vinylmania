import { useState } from 'react';
import { useLocation, useParams } from 'react-router-dom';

import { DiscogsRelinkNotice } from '../components/DiscogsRelinkNotice';
import { RecordDetailSkeleton } from '../components/RecordDetailSkeleton';
import { ReleaseAdditionalInfoSection } from '../components/ReleaseAdditionalInfoSection';
import { ReleaseDetailsSection } from '../components/ReleaseDetailsSection';
import { ReleaseImageGallery } from '../components/ReleaseImageGallery';
import { ReleaseTracklistSection } from '../components/ReleaseTracklistSection';
import { BackLink } from '../components/ui/BackLink';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { useCatalogRelease } from '../queries/discogsQueries';
import { useCreateLibraryEntry } from '../queries/libraryQueries';
import { ApiError } from '../services/apiClient';

const DEFAULT_BACK_PATH = '/app/search';

export function ReleaseDetailPage() {
  const { discogsId } = useParams<{ discogsId: string }>();
  const location = useLocation();
  const backTo = (location.state as { from?: string } | null)?.from ?? DEFAULT_BACK_PATH;

  const parsedId = Number(discogsId);
  const { data: release, isLoading, isError, error: releaseError } = useCatalogRelease(parsedId);
  // The release fetch itself (not just the "add to library" mutation) can
  // fail with discogs_link_invalid when the caller's linked account was
  // revoked (spec 053, US3) — distinguished from a genuine 404.
  const relinkRequired =
    isError && releaseError instanceof ApiError && releaseError.code === 'discogs_link_invalid';
  const notFound = isError && !relinkRequired;
  const createEntry = useCreateLibraryEntry();

  const [added, setAdded] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [gateError, setGateError] = useState<'not-linked' | 'relink' | null>(null);

  async function handleAdd() {
    setAddError(null);
    setGateError(null);
    try {
      await createEntry.mutateAsync({ discogsReleaseId: parsedId });
      setAdded(true);
    } catch (err) {
      if (err instanceof ApiError && err.code === 'discogs_not_linked') {
        setGateError('not-linked');
      } else if (err instanceof ApiError && err.code === 'discogs_link_invalid') {
        setGateError('relink');
      } else {
        setAddError('Something went wrong while adding this record. Please try again.');
      }
    }
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
            Couldn&apos;t find that release in the catalog.
          </p>
        </Card>
      </main>
    );
  }

  if (isLoading || !release) {
    return (
      <main className="mx-auto flex max-w-5xl flex-col gap-6 p-6 sm:p-8 xl:max-w-7xl">
        <BackLink to={backTo} />
        <RecordDetailSkeleton />
      </main>
    );
  }

  const hasOtherDetails =
    Boolean(release.notes) ||
    (release.identifiers?.length ?? 0) > 0 ||
    Boolean(release.community);

  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-6 p-6 sm:p-8 xl:max-w-7xl">
      <BackLink to={backTo} />
      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-2">
        <Card data-testid="release-detail-gallery-card" padding="sm">
          <ReleaseImageGallery images={release.images} alt={release.title} />
        </Card>

        <Card data-testid="release-detail-main-info-card" padding="sm">
          <div className="flex flex-col gap-4">
            <ReleaseDetailsSection release={release} />
            <div className="flex flex-col gap-2">
              <Button
                onClick={handleAdd}
                loading={createEntry.isPending}
                disabled={added}
              >
                {added ? 'Added to library' : 'Add to library'}
              </Button>
              {gateError && (
                <p className="text-sm text-stone-500 dark:text-stone-400">
                  {gateError === 'not-linked'
                    ? 'You need to link your Discogs account before adding records to your library.'
                    : 'Your Discogs link is no longer valid. Please re-link your account to add records.'}
                </p>
              )}
              {addError && (
                <p role="alert" className="text-sm text-red-600 dark:text-red-400">
                  {addError}
                </p>
              )}
            </div>
          </div>
        </Card>

        <Card data-testid="release-detail-tracklist-card" padding="sm" className="lg:col-span-2">
          <ReleaseTracklistSection tracklist={release.tracklist} />
        </Card>

        {hasOtherDetails && (
          <Card
            data-testid="release-detail-other-details-card"
            padding="sm"
            className="lg:col-span-2"
          >
            <ReleaseAdditionalInfoSection
              notes={release.notes}
              identifiers={release.identifiers}
              community={release.community}
            />
          </Card>
        )}
      </div>
    </main>
  );
}
