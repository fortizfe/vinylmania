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
import { WantlistPanel } from '../components/WantlistPanel';
import { useCatalogRelease } from '../queries/discogsQueries';
import { useCreateLibraryEntry } from '../queries/libraryQueries';
import {
  useAddToWantlist,
  useUpdateWantEntry,
  useWantlistEntry,
} from '../queries/wantlistQueries';
import { ApiError } from '../services/apiClient';

const DEFAULT_BACK_PATH = '/app/search';

/**
 * Feature 060, FR-013: the library add succeeded but the automatic wantlist
 * removal did not — non-blocking, the user just needs to tidy their wishlist.
 */
const WISHLIST_REMOVAL_FAILED_NOTICE =
  "Added to your library. We couldn't remove it from your wishlist — remove it there when you can.";

/**
 * The Discogs-link gate can be tripped by either add action (feature 060,
 * US2). The two destinations carry their own copy so the message names the
 * section the user was actually adding to — never the wrong one.
 */
type GateError = { variant: 'not-linked' | 'relink'; context: 'library' | 'wishlist' };

function gateMessage({ variant, context }: GateError): string {
  const target = context === 'wishlist' ? 'your wishlist' : 'your library';
  return variant === 'relink'
    ? `Your Discogs link is no longer valid. Please re-link your account to add records to ${target}.`
    : `You need to link your Discogs account before adding records to ${target}.`;
}

export function ReleaseDetailPage() {
  const { discogsId } = useParams<{ discogsId: string }>();
  const location = useLocation();
  const backTo = (location.state as { from?: string } | null)?.from ?? DEFAULT_BACK_PATH;

  const parsedId = Number(discogsId);
  const {
    data: release,
    isLoading,
    isError,
    error: releaseError,
  } = useCatalogRelease(parsedId);
  // The release fetch itself (not just the "add to library" mutation) can
  // fail with discogs_link_invalid when the caller's linked account was
  // revoked (spec 053, US3) — distinguished from a genuine 404.
  const relinkRequired =
    isError &&
    releaseError instanceof ApiError &&
    releaseError.code === 'discogs_link_invalid';
  const notFound = isError && !relinkRequired;
  const createEntry = useCreateLibraryEntry();
  const addToWantlist = useAddToWantlist();
  // FR-008: the wantlist panel is shown only when this release is in the
  // user's wantlist. GET /api/wantlist/:releaseId 404s (not_in_wantlist) as a
  // query error otherwise; `useAddToWantlist` invalidates `wantlistKeys.all`,
  // so this query refetches and the panel appears after an add — no reload.
  const wantlistEntry = useWantlistEntry(Number.isNaN(parsedId) ? undefined : parsedId);
  const updateWantEntry = useUpdateWantEntry(parsedId);

  const [added, setAdded] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [gateError, setGateError] = useState<GateError | null>(null);
  const [addedToWantlist, setAddedToWantlist] = useState(false);
  const [wantlistError, setWantlistError] = useState<string | null>(null);
  const [wantlistNote, setWantlistNote] = useState<string | null>(null);

  async function handleAdd() {
    setAddError(null);
    setGateError(null);
    setWantlistNote(null);
    try {
      const entry = await createEntry.mutateAsync({ discogsReleaseId: parsedId });
      setAdded(true);
      if (entry.wantlistRemoval === 'failed') {
        setWantlistNote(WISHLIST_REMOVAL_FAILED_NOTICE);
      }
    } catch (err) {
      if (err instanceof ApiError && err.code === 'discogs_not_linked') {
        setGateError({ variant: 'not-linked', context: 'library' });
      } else if (err instanceof ApiError && err.code === 'discogs_link_invalid') {
        setGateError({ variant: 'relink', context: 'library' });
      } else {
        setAddError('Something went wrong while adding this record. Please try again.');
      }
    }
  }

  async function handleAddToWantlist() {
    setWantlistError(null);
    setWantlistNote(null);
    setGateError(null);
    try {
      const result = await addToWantlist.mutateAsync({ discogsReleaseId: parsedId });
      setAddedToWantlist(true);
      if (result.alreadyInLibrary) {
        setWantlistNote('This is already in your library.');
      }
    } catch (err) {
      if (err instanceof ApiError && err.code === 'discogs_not_linked') {
        setGateError({ variant: 'not-linked', context: 'wishlist' });
      } else if (err instanceof ApiError && err.code === 'discogs_link_invalid') {
        setGateError({ variant: 'relink', context: 'wishlist' });
      } else {
        setWantlistError(
          'Something went wrong while adding this record to your wishlist. Please try again.',
        );
      }
    }
  }

  async function handleSaveWantlistRating(rating: number) {
    await updateWantEntry.mutateAsync({ rating });
  }

  async function handleSaveWantlistNotes(notes: string) {
    await updateWantEntry.mutateAsync({ notes });
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
              <div className="flex flex-wrap gap-2">
                <Button
                  onClick={handleAdd}
                  loading={createEntry.isPending}
                  disabled={added}
                >
                  {added ? 'Added to library' : 'Add to library'}
                </Button>
                <Button
                  variant="secondary"
                  onClick={handleAddToWantlist}
                  loading={addToWantlist.isPending}
                  disabled={addedToWantlist}
                >
                  {addedToWantlist ? 'Added to wishlist' : 'Add to wishlist'}
                </Button>
              </div>
              {gateError && (
                <p role="status" className="text-sm text-stone-500 dark:text-stone-400">
                  {gateMessage(gateError)}
                </p>
              )}
              {wantlistNote && (
                <p role="status" className="text-sm text-stone-500 dark:text-stone-400">
                  {wantlistNote}
                </p>
              )}
              {addError && (
                <p role="alert" className="text-sm text-red-600 dark:text-red-400">
                  {addError}
                </p>
              )}
              {wantlistError && (
                <p role="alert" className="text-sm text-red-600 dark:text-red-400">
                  {wantlistError}
                </p>
              )}
            </div>
          </div>
        </Card>

        {wantlistEntry.data && !wantlistEntry.isError && (
          <Card
            data-testid="release-detail-wantlist-panel-card"
            padding="sm"
            className="lg:col-span-2"
          >
            <WantlistPanel
              entry={wantlistEntry.data}
              onSaveRating={handleSaveWantlistRating}
              onSaveNotes={handleSaveWantlistNotes}
            />
          </Card>
        )}

        <Card
          data-testid="release-detail-tracklist-card"
          padding="sm"
          className="lg:col-span-2"
        >
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
