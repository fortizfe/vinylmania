import { useLocation, useNavigate, useParams } from 'react-router-dom';

import { MyCopySection } from '../components/MyCopySection';
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
import { presentRating } from '../lib/releaseRating';
import {
  useLibraryEntry,
  useRemoveLibraryEntry,
  useUpdateLibraryEntry,
} from '../queries/libraryQueries';

const REMOVE_FAILED_MESSAGE =
  'Something went wrong while removing this record. Please try again.';

export function RecordDetailPage() {
  const { entryId } = useParams<{ entryId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  // FR-015a: return to the exact library address this record was opened from
  // (sort + filters). Opened directly — bookmark, shared link — fall back to
  // the plain library (research D12).
  const backTo = (location.state as { from?: string } | null)?.from ?? '/app/library';
  const { data: entry, isLoading, isError: notFound } = useLibraryEntry(entryId);
  const updateEntry = useUpdateLibraryEntry(entryId ?? '');
  const removeEntry = useRemoveLibraryEntry();

  async function handleRemove() {
    if (!entryId) return;
    if (!window.confirm('Remove this record from your library? This cannot be undone.')) {
      return;
    }
    try {
      await removeEntry.mutateAsync(entryId);
      navigate(backTo);
    } catch {
      // Error surfaced through the action bar via removeEntry.isError.
    }
  }

  async function saveRating(rating: number) {
    await updateEntry.mutateAsync({ rating });
  }

  async function saveMediaCondition(value: string | null) {
    await updateEntry.mutateAsync({ mediaCondition: value ?? undefined });
  }

  async function saveSleeveCondition(value: string | null) {
    await updateEntry.mutateAsync({ sleeveCondition: value ?? undefined });
  }

  async function saveNotes(notes: string) {
    await updateEntry.mutateAsync({ notes });
  }

  const actions = (
    <RecordDetailActions
      view="library"
      onRemove={handleRemove}
      removing={removeEntry.isPending}
      removeError={removeEntry.isError ? REMOVE_FAILED_MESSAGE : undefined}
    />
  );

  if (notFound) {
    return (
      <main className="mx-auto flex max-w-2xl flex-col gap-6 p-6 sm:p-8">
        <BackLink to={backTo} />
        {actions}
        <Card>
          <p className="text-stone-500 dark:text-stone-400">
            Couldn&apos;t find that record in your library.
          </p>
        </Card>
      </main>
    );
  }

  if (isLoading || !entry) {
    return (
      <main className="mx-auto flex max-w-5xl flex-col gap-6 p-6 sm:p-8 xl:max-w-7xl">
        <BackLink to={backTo} />
        <RecordDetailSkeleton />
      </main>
    );
  }

  // `MyCopySection` is condition + notes only (US3 / §C5). The personal rating
  // lives solely in `RatingCard` (US2); Remove lives solely in
  // `RecordDetailActions` (US1 / FR-012).
  const myCopySection = (
    <MyCopySection
      discogs={entry.discogs}
      onSaveMediaCondition={saveMediaCondition}
      onSaveSleeveCondition={saveSleeveCondition}
      onSaveNotes={saveNotes}
    />
  );

  if (entry.catalogStatus === 'unavailable' || !entry.release) {
    // Catalog details are gone, but the collector must still be able to edit
    // their copy and remove the record (FR-018 / FR-019).
    return (
      <main className="mx-auto flex max-w-2xl flex-col gap-6 p-6 sm:p-8">
        <BackLink to={backTo} />
        {actions}
        <Card>
          <p className="text-stone-500 dark:text-stone-400">
            Couldn&apos;t load catalog details for this record right now.
          </p>
        </Card>
        <Card data-testid={RECORD_DETAIL_TESTIDS.YOUR_COPY_CARD} padding="sm">
          {myCopySection}
        </Card>
      </main>
    );
  }

  const { release } = entry;
  const hasOtherDetails =
    Boolean(release.notes) || (release.identifiers?.length ?? 0) > 0;

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
      myCopy={
        <Card data-testid={RECORD_DETAIL_TESTIDS.YOUR_COPY_CARD} padding="sm">
          {myCopySection}
        </Card>
      }
      rating={
        <RatingCard
          community={{
            presentation: presentRating(release.community?.rating),
            count: release.community?.rating.count ?? 0,
            have: release.community?.have ?? null,
            want: release.community?.want ?? null,
          }}
          personal={
            entry.discogs
              ? {
                  value: entry.discogs.rating,
                  onSave: saveRating,
                  saving: updateEntry.isPending,
                }
              : undefined
          }
        />
      }
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
