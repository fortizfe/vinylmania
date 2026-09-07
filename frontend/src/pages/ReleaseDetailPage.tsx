import { useState } from 'react';
import { useLocation, useParams } from 'react-router-dom';

import { DiscogsRelinkNotice } from '../components/DiscogsRelinkNotice';
import { RecordDetailActions } from '../components/recordDetail/RecordDetailActions';
import { RecordDetailLayout } from '../components/recordDetail/RecordDetailLayout';
import { RecordDetailSkeleton } from '../components/recordDetail/RecordDetailSkeleton';
import { RECORD_DETAIL_TESTIDS } from '../components/recordDetail/testIds';
import { RatingCard } from '../components/recordDetail/RatingCard';
import { ReleaseAdditionalInfoSection } from '../components/ReleaseAdditionalInfoSection';
import { ReleaseDetailsSection } from '../components/ReleaseDetailsSection';
import { ReleaseImageGallery } from '../components/ReleaseImageGallery';
import { ReleaseTracklistSection } from '../components/ReleaseTracklistSection';
import { StreamingLinksSection } from '../components/StreamingLinksSection';
import { BackLink } from '../components/ui/BackLink';
import { Card } from '../components/ui/Card';
import { WantlistPanel } from '../components/WantlistPanel';
import { presentRating } from '../lib/releaseRating';
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

  const isInWantlist = Boolean(wantlistEntry.data) && !wantlistEntry.isError;
  const view: 'search' | 'wishlist' = isInWantlist ? 'wishlist' : 'search';

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

  const gateNote = gateError ? gateMessage(gateError) : null;

  // The action bar renders in every branch (FR-012 / FR-020), so build it once.
  const actions =
    view === 'wishlist' ? (
      <RecordDetailActions
        view="wishlist"
        onAddToLibrary={handleAdd}
        addingToLibrary={createEntry.isPending}
        addedToLibrary={added}
        gateMessage={gateNote}
        notice={wantlistNote}
        libraryError={addError}
      />
    ) : (
      <RecordDetailActions
        view="search"
        onAddToLibrary={handleAdd}
        onAddToWishlist={handleAddToWantlist}
        addingToLibrary={createEntry.isPending}
        addingToWishlist={addToWantlist.isPending}
        addedToLibrary={added}
        addedToWishlist={addedToWantlist}
        gateMessage={gateNote}
        notice={wantlistNote}
        libraryError={addError}
        wishlistError={wantlistError}
      />
    );

  if (relinkRequired) {
    return (
      <main className="mx-auto flex max-w-2xl flex-col gap-6 p-6 sm:p-8">
        <BackLink to={backTo} />
        {actions}
        <DiscogsRelinkNotice />
      </main>
    );
  }

  if (notFound) {
    return (
      <main className="mx-auto flex max-w-2xl flex-col gap-6 p-6 sm:p-8">
        <BackLink to={backTo} />
        {actions}
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
    Boolean(release.notes) || (release.identifiers?.length ?? 0) > 0;

  const rating = (
    <>
      <RatingCard
        community={{
          presentation: presentRating(release.community?.rating),
          count: release.community?.rating.count ?? 0,
          have: release.community?.have ?? null,
          want: release.community?.want ?? null,
        }}
      />
      {isInWantlist && wantlistEntry.data && (
        <Card
          data-testid="release-detail-wantlist-panel-card"
          padding="sm"
          className="mt-4"
        >
          <WantlistPanel
            entry={wantlistEntry.data}
            onSaveRating={handleSaveWantlistRating}
            onSaveNotes={handleSaveWantlistNotes}
          />
        </Card>
      )}
    </>
  );

  return (
    <RecordDetailLayout
      backTo={backTo}
      actions={actions}
      gallery={
        <Card data-testid={RECORD_DETAIL_TESTIDS.GALLERY_CARD} padding="sm">
          <ReleaseImageGallery images={release.images} alt={release.title} />
        </Card>
      }
      generalInfo={
        <Card data-testid={RECORD_DETAIL_TESTIDS.MAIN_INFO_CARD} padding="sm">
          <ReleaseDetailsSection release={release} />
        </Card>
      }
      rating={rating}
      streaming={
        <StreamingLinksSection
          identifiers={release.identifiers}
          artist={release.artists[0]?.name}
          title={release.title}
        />
      }
      tracklist={
        <Card data-testid={RECORD_DETAIL_TESTIDS.TRACKLIST_CARD} padding="sm">
          <ReleaseTracklistSection tracklist={release.tracklist} />
        </Card>
      }
      catalogInfo={
        hasOtherDetails ? (
          <Card data-testid={RECORD_DETAIL_TESTIDS.OTHER_DETAILS_CARD} padding="sm">
            <ReleaseAdditionalInfoSection
              notes={release.notes}
              identifiers={release.identifiers}
            />
          </Card>
        ) : null
      }
    />
  );
}
